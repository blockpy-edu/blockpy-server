/**
 * The Submissions Filter is the instructor-facing interface for reviewing a course's
 * submissions, filtered by user and/or assignment. It replaces the server-rendered
 * logic that used to live in `templates/courses/submissions_filter.html` (and its
 * `helpers/submission_table.html` include), keeping all of the same behavior and
 * layout: the submissions table with its row coloring, group headers, sortable
 * columns, per-row actions (view, downloads, history, copy, regrades), the bulk
 * regrade and bulk download tools, and the "show only learners" toggle.
 *
 * It also adopts the Watcher interface's selection features: instead of two plain
 * dropdowns, students and assignments are chosen through the set selectors (all /
 * a specific one / a saved set), so submissions can be filtered by saved sets,
 * and the user display settings control how names are rendered and sorted.
 *
 * The form is structured as three sequential questions - whose submissions
 * (Students), which assignments (Assignments), and which submissions match
 * additional conditions (Submission filters) - with a human-readable summary of
 * the pending query and a single "View submissions" action.
 *
 * Data comes from the course-scoped `courses/submissions_filter/get` endpoint.
 */
import * as ko from 'knockout';
import {Server} from "../../services/server";
import {Course} from "../../models/course";
import {User, Role, cleanRole} from "../../models/user";
import {Assignment, compareAssignmentsByGroup} from "../../models/assignment";
import {ModelSet, SelectMode} from "../model_selector";
import '../model_selector';
import {ajax_post} from "../../services/ajax";
import {prettyPrintDateTime} from "../../utilities/dates";
import {STORAGE_SERVICE} from "../../utilities/safe_local_storage";

import SUBMISSIONS_FILTER_HTML from "./submissions_filter.html";

export interface SubmissionsFilterJson {
    server: Server;
    course: Course;
    user: User;
    criteria: string;
    searchKey: number;
    userIds: string;
    assignmentIds: string;
}

/** The lightweight submission encoding from `courses/submissions_filter/get`. */
export interface FilterSubmissionJson {
    id: number;
    user_id: number;
    assignment_id: number;
    assignment_group_id: number | null;
    course_id: number;
    score: number;
    correct: boolean;
    submission_status: string;
    grading_status: string;
    version: number;
    date_created: string;
    date_modified: string;
    human_submission_status: string;
    human_grading_status: string;
}

export interface SubmissionRow {
    isGroupHeader: false;
    submission: FilterSubmissionJson | null;
    user: User | null;
    assignment: Assignment | null;
}

export interface GroupHeaderRow {
    isGroupHeader: true;
    groupName: string;
    viewGroupUrl: string | null;
}

export type DisplayRow = SubmissionRow | GroupHeaderRow;

export type FilterMode = "assignment" | "student" | "both";

interface ColumnSpec {
    label: string;
    // Matches the old table's data-type attribute: how cell values compare when sorting
    type: "string" | "number";
    sortKey: ((row: SubmissionRow) => string | number) | null;
}

/** Mirrors Jinja's score|round(1), used everywhere a score is shown or compared. */
export function roundScore(score: number): number {
    return Math.round(score * 10) / 10;
}

/** Rounds to one decimal, dropping it when whole: 20 -> "20", 20.5 -> "20.5". */
export function formatScore(score: number): string {
    const rounded = roundScore(score);
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** One remembered selection: which users and assignments were viewed. */
export interface HistoryEntry {
    userIds: string;
    assignmentIds: string;
}

const HISTORY_LIMIT = 6;
const BULK_REGRADE_WAIT = 200;

/*
 * Search criteria: each criterion is (field, operator, value, negate?), combined
 * with a single combinator (and/or/none/xor). Evaluation happens server-side,
 * where the full code/feedback contents live.
 */

export interface SearchOperator {
    key: string;
    label: string;
}

export interface SearchFieldSpec {
    key: string;
    label: string;
    type: "number" | "text" | "select" | "date";
    operators: SearchOperator[];
    options?: {value: string, label: string}[];
    placeholder?: string;
    // Shown under the condition row while this field is selected
    help?: string;
}

const NUMBER_OPERATORS: SearchOperator[] = [
    {key: "ge", label: "is at least"},
    {key: "gt", label: "is more than"},
    {key: "eq", label: "is exactly"},
    {key: "ne", label: "is not"},
    {key: "le", label: "is at most"},
    {key: "lt", label: "is less than"}
];
const TEXT_OPERATORS: SearchOperator[] = [
    {key: "contains", label: "contains"},
    {key: "icontains", label: "contains (ignore case)"},
    {key: "regex", label: "matches regex"}
];
const DATE_OPERATORS: SearchOperator[] = [
    {key: "before", label: "is before"},
    {key: "on", label: "is on"},
    {key: "after", label: "is after"}
];
const IS_OPERATOR: SearchOperator[] = [{key: "is", label: "is"}];

export const SEARCH_FIELDS: SearchFieldSpec[] = [
    {key: "score", label: "Score (%)", type: "number", operators: NUMBER_OPERATORS,
     placeholder: "0-100",
     help: "The recorded percentage (0–100). A submission can score high without being " +
           "flagged correct, so also filter on Correctness when in doubt."},
    {key: "correct", label: "Correctness", type: "select", operators: IS_OPERATOR,
     options: [{value: "true", label: "Correct (fully complete)"},
               {value: "false", label: "Not correct"}],
     help: "The completion flag, which is separate from the score — a submission " +
           "can be flagged correct or not regardless of its score."},
    {key: "code", label: "Code contents", type: "text", operators: TEXT_OPERATORS,
     placeholder: "text to look for in the code",
     help: "Checked on the server against the submission's saved code."},
    {key: "feedback", label: "Feedback contents", type: "text", operators: TEXT_OPERATORS,
     placeholder: "text to look for in the feedback",
     help: "Checked on the server against the feedback the student was shown."},
    {key: "code_length", label: "Code length (characters)", type: "number",
     operators: NUMBER_OPERATORS, placeholder: "e.g. 20"},
    {key: "version", label: "Number of edits", type: "number", operators: NUMBER_OPERATORS,
     placeholder: "e.g. 5"},
    {key: "submission_status", label: "Submission status", type: "select", operators: IS_OPERATOR,
     options: [{value: "Initialized", label: "Initialized (never started)"},
               {value: "Started", label: "Started (never run)"},
               {value: "inProgress", label: "In progress"},
               {value: "Submitted", label: "Submitted"},
               {value: "Completed", label: "Completed"}]},
    {key: "grading_status", label: "Grading status", type: "select", operators: IS_OPERATOR,
     options: [{value: "FullyGraded", label: "Fully graded"},
               {value: "Pending", label: "Pending (maybe done)"},
               {value: "PendingManual", label: "Human grading in progress"},
               {value: "Failed", label: "Grade failed to transfer"},
               {value: "NotReady", label: "Not yet graded"}]},
    {key: "date_created", label: "Started date", type: "date", operators: DATE_OPERATORS},
    {key: "date_modified", label: "Last edited date", type: "date", operators: DATE_OPERATORS}
];

// Labels complete the sentence "Match ___ of the following conditions"
export const SEARCH_COMBINATORS = [
    {key: "and", label: "all"},
    {key: "or", label: "any"},
    {key: "none", label: "none"},
    {key: "xor", label: "exactly one"}
];

export class SearchCriterion {
    field: KnockoutObservable<string>;
    operator: KnockoutObservable<string>;
    value: KnockoutObservable<string>;
    negate: KnockoutObservable<boolean>;
    spec: KnockoutReadonlyComputed<SearchFieldSpec>;

    constructor() {
        this.field = ko.observable(SEARCH_FIELDS[0].key);
        this.operator = ko.observable(SEARCH_FIELDS[0].operators[0].key);
        this.value = ko.observable("");
        this.negate = ko.observable(false);
        this.spec = ko.pureComputed(() =>
            SEARCH_FIELDS.find((fieldSpec) => fieldSpec.key === this.field()) || SEARCH_FIELDS[0]);
        this.field.subscribe(() => {
            this.operator(this.spec().operators[0].key);
            this.value(this.spec().type === "select" ? this.spec().options[0].value : "");
        });
    }

    toJson() {
        return {
            field: this.field(),
            operator: this.operator(),
            value: this.value(),
            negate: this.negate()
        };
    }
}

export class SubmissionsFilter {
    server: Server;
    course: Course;
    user: User;

    // Selection state (the set selectors write into these)
    userSet: KnockoutObservable<ModelSet>;
    assignmentSet: KnockoutObservable<ModelSet>;
    userDefault: string;
    assignmentDefault: string;
    // Two-way mode channels with the selectors, to prevent ALL x ALL
    userSelectMode: KnockoutObservable<SelectMode>;
    assignmentSelectMode: KnockoutObservable<SelectMode>;
    // Push channels to re-apply a selection to the selectors (history clicks)
    userApply: KnockoutObservable<string>;
    assignmentApply: KnockoutObservable<string>;
    // Set once each selector has applied its default selection; the ALL x ALL
    // rule must not react to initialization noise before then
    userSelectorReady: KnockoutObservable<boolean>;
    assignmentSelectorReady: KnockoutObservable<boolean>;
    // Recently viewed selections, most recent first, persisted per course
    history: ko.ObservableArray<HistoryEntry>;

    // Search criteria (evaluated server-side against the selected submissions)
    searchFields = SEARCH_FIELDS;
    combinatorOptions = SEARCH_COMBINATORS;
    searchCombinator: KnockoutObservable<string>;
    searchCriteria: ko.ObservableArray<SearchCriterion>;
    searchErrors: ko.ObservableArray<string>;
    // Whether the currently displayed results were produced by a search
    loadedSearchActive: ko.Observable<boolean>;

    // The full course rosters, loaded once, for placeholder rows
    availableUsers: ko.ObservableArray<User>;
    availableAssignments: ko.ObservableArray<Assignment>;

    // What the last load actually asked for ([] means "everything")
    loadedUserIds: ko.ObservableArray<number>;
    loadedAssignmentIds: ko.ObservableArray<number>;
    submissions: ko.ObservableArray<FilterSubmissionJson>;

    hasLoaded: ko.Observable<boolean>;
    isLoading: ko.Observable<boolean>;
    hasFailed: ko.Observable<boolean>;

    // Table display state
    showOnlyLearners: ko.Observable<boolean>;
    sortIndex: ko.Observable<number>;
    appliedSortDirection: ko.Observable<string>;
    private sortDirections: Record<number, string>;
    bulkRegradeStatus: ko.Observable<string>;

    effectiveUsers: ko.PureComputed<User[]>;
    effectiveAssignments: ko.PureComputed<Assignment[]>;
    mode: ko.PureComputed<FilterMode>;
    isAssignmentMode: ko.PureComputed<boolean>;
    isStudentMode: ko.PureComputed<boolean>;
    showAssignmentColumn: ko.PureComputed<boolean>;
    showStudentColumns: ko.PureComputed<boolean>;
    columns: ko.PureComputed<ColumnSpec[]>;
    displayRows: ko.PureComputed<DisplayRow[]>;
    groupHeaderColspan: ko.PureComputed<number>;
    singleAssignment: ko.PureComputed<Assignment | null>;
    singleUser: ko.PureComputed<User | null>;
    // Human-readable interpretation of the pending selection, shown above the button
    querySummary: ko.PureComputed<string>;

    constructor(params: SubmissionsFilterJson) {
        this.server = params.server;
        this.course = params.course;
        this.user = params.user;

        this.userSet = ko.observable<ModelSet>(null);
        this.assignmentSet = ko.observable<ModelSet>(null);
        this.userSelectMode = ko.observable<SelectMode>(null);
        this.assignmentSelectMode = ko.observable<SelectMode>(null);
        this.userApply = ko.observable<string>(null);
        this.assignmentApply = ko.observable<string>(null);
        this.history = ko.observableArray<HistoryEntry>(this.loadHistory());
        this.searchCombinator = ko.observable("and");
        this.searchCriteria = ko.observableArray<SearchCriterion>([]);
        this.searchErrors = ko.observableArray<string>([]);
        this.loadedSearchActive = ko.observable(false);

        // Never allow "All users" x "All assignments": switching one side to All
        // flips the other side to Only (which picks its first entry). Only enforce
        // once both selectors have applied their defaults - during initialization
        // both briefly claim ALL, and reacting then would corrupt the defaults.
        this.userSelectorReady = ko.observable(false);
        this.assignmentSelectorReady = ko.observable(false);
        const exclusionArmed = () => this.userSelectorReady() && this.assignmentSelectorReady();
        this.userSelectMode.subscribe((mode: SelectMode) => {
            if (exclusionArmed() && mode === SelectMode.ALL
                    && this.assignmentSelectMode() === SelectMode.ALL) {
                this.assignmentSelectMode(SelectMode.SINGLE);
            }
        });
        this.assignmentSelectMode.subscribe((mode: SelectMode) => {
            if (exclusionArmed() && mode === SelectMode.ALL
                    && this.userSelectMode() === SelectMode.ALL) {
                this.userSelectMode(SelectMode.SINGLE);
            }
        });

        const criteria = params.criteria || "none";
        const searchKey = params.searchKey;
        // Initial selection: URL criteria/search_key or user_ids/assignment_ids
        // (deep links), then the most recently viewed selection, then the default
        // of all users on the first assignment.
        let autoLoad: HistoryEntry = null;
        let loadFirstAssignment = false;
        if (criteria === "assignment" && searchKey > 0) {
            this.userDefault = params.userIds || "";
            this.assignmentDefault = String(searchKey);
            autoLoad = {userIds: this.userDefault, assignmentIds: this.assignmentDefault};
        } else if (criteria === "student" && searchKey > 0) {
            this.userDefault = String(searchKey);
            this.assignmentDefault = params.assignmentIds || "";
            autoLoad = {userIds: this.userDefault, assignmentIds: this.assignmentDefault};
        } else if (params.userIds || params.assignmentIds) {
            this.userDefault = params.userIds || "";
            this.assignmentDefault = params.assignmentIds || "";
            autoLoad = {userIds: this.userDefault, assignmentIds: this.assignmentDefault};
        } else if (this.history().length) {
            const recent = this.history()[0];
            this.userDefault = recent.userIds;
            this.assignmentDefault = recent.assignmentIds;
            autoLoad = {userIds: recent.userIds, assignmentIds: recent.assignmentIds};
        } else {
            this.userDefault = "";
            this.assignmentDefault = "first";
            loadFirstAssignment = true;
        }

        this.availableUsers = ko.observableArray<User>([]);
        this.availableAssignments = ko.observableArray<Assignment>([]);

        this.loadedUserIds = ko.observableArray<number>([]);
        this.loadedAssignmentIds = ko.observableArray<number>([]);
        this.submissions = ko.observableArray<FilterSubmissionJson>([]);

        this.hasLoaded = ko.observable(false);
        this.isLoading = ko.observable(false);
        this.hasFailed = ko.observable(false);

        this.showOnlyLearners = ko.observable(false);
        this.sortIndex = ko.observable<number>(null);
        this.appliedSortDirection = ko.observable("asc");
        this.sortDirections = {};
        this.bulkRegradeStatus = ko.observable("");

        // Load the full rosters (instant when the page preloaded them into the
        // stores); the set selectors share the same stores/data.
        this.server.userStore.getAllAvailable().then((users: User[]) => {
            this.availableUsers(users);
        });
        this.server.assignmentStore.getAllAvailable().then((assignments: Assignment[]) => {
            this.availableAssignments(assignments);
            if (loadFirstAssignment && assignments.length) {
                this.load("", String(assignments[0].id));
            }
        });

        this.effectiveUsers = ko.pureComputed<User[]>(() => {
            const chosen = this.loadedUserIds();
            const users = chosen.length
                ? chosen.map((id: number) => this.server.userStore.getInstance(id))
                : this.availableUsers().slice();
            return users.sort(this.server.userStore.sortMethod.bind(this.server.userStore));
        });
        this.effectiveAssignments = ko.pureComputed<Assignment[]>(() => {
            const chosen = this.loadedAssignmentIds();
            const assignments = chosen.length
                ? chosen.map((id: number) => this.server.assignmentStore.getInstance(id))
                : this.availableAssignments().slice();
            return assignments.sort(compareAssignmentsByGroup);
        });

        // Which layout the old page would have used: filtering to one assignment
        // shows the student columns; filtering to one student shows the assignment
        // column (with group headers); anything else (a new capability) shows both.
        this.mode = ko.pureComputed<FilterMode>(() => {
            const userCount = this.effectiveUsers().length;
            const assignmentCount = this.effectiveAssignments().length;
            if (assignmentCount === 1 && userCount !== 1) {
                return "assignment";
            } else if (userCount === 1 && assignmentCount !== 1) {
                return "student";
            } else {
                return "both";
            }
        });
        this.isAssignmentMode = ko.pureComputed(() => this.mode() === "assignment");
        this.isStudentMode = ko.pureComputed(() => this.mode() === "student");
        this.showAssignmentColumn = ko.pureComputed(() => this.mode() !== "assignment");
        this.showStudentColumns = ko.pureComputed(() => this.mode() !== "student");
        this.singleAssignment = ko.pureComputed(() =>
            this.effectiveAssignments().length === 1 ? this.effectiveAssignments()[0] : null);
        this.singleUser = ko.pureComputed(() =>
            this.effectiveUsers().length === 1 ? this.effectiveUsers()[0] : null);

        this.columns = ko.pureComputed<ColumnSpec[]>(() => this.makeColumns());
        this.groupHeaderColspan = ko.pureComputed(() => this.columns().length - 1);
        this.displayRows = ko.pureComputed<DisplayRow[]>(() => this.makeDisplayRows());

        // "1 student • 2 assignments • No submission filters": what would be
        // queried right now, so the form can be checked at a glance.
        this.querySummary = ko.pureComputed<string>(() => {
            const userIds = this.normalizeSelection(
                this.userSet() != null ? this.userSet().getIds() : "", this.availableUsers());
            const assignmentIds = this.normalizeSelection(
                this.assignmentSet() != null ? this.assignmentSet().getIds() : "",
                this.availableAssignments());
            const students = this.describeSelection(userIds,
                this.server.userStore, "All students", "students");
            const assignments = this.describeSelection(assignmentIds,
                this.server.assignmentStore, "All assignments", "assignments");
            const filterCount = this.searchCriteria().length;
            const filters = filterCount === 0 ? "No submission filters"
                : filterCount === 1 ? "1 submission filter"
                : `${filterCount} submission filters`;
            return `${students} • ${assignments} • ${filters}`;
        });

        if (autoLoad != null) {
            this.load(autoLoad.userIds, autoLoad.assignmentIds);
        }
    }

    /** Load submissions from the "View Submissions" button, using the current sets. */
    viewSubmissions() {
        const userIds = this.userSet() != null ? this.userSet().getIds() : this.userDefault;
        const assignmentIds = this.assignmentSet() != null ? this.assignmentSet().getIds() : this.assignmentDefault;
        this.load(userIds, assignmentIds);
    }

    load(userIds: string, assignmentIds: string) {
        assignmentIds = this.normalizeSelection(assignmentIds, this.availableAssignments());
        const normalizedUserIds = this.normalizeSelection(userIds, this.availableUsers());
        // Everything x everything is not a real selection; keep the explicit list
        // rather than collapsing both sides to "all".
        if (!(normalizedUserIds === "" && assignmentIds === "")) {
            userIds = normalizedUserIds;
        }
        const search = this.serializeSearch();
        this.isLoading(true);
        this.hasFailed(false);
        ajax_post("courses/submissions_filter/get", {
            course_id: this.course.id,
            user_ids: userIds,
            assignment_ids: assignmentIds,
            search: search
        }).then((data: any) => {
            this.isLoading(false);
            this.hasFailed(!data.success);
            if (data.success) {
                this.loadedUserIds(this.parseIds(userIds));
                this.loadedAssignmentIds(this.parseIds(assignmentIds));
                this.submissions(data.submissions);
                this.loadedSearchActive(search !== "");
                this.searchErrors(data.search_errors || []);
                this.sortIndex(null);
                this.sortDirections = {};
                this.hasLoaded(true);
                this.updateUrl();
                this.pushHistory(userIds, assignmentIds);
            } else {
                console.error("Loading submissions failed!", data);
            }
        }).fail((error: any) => {
            console.error("Loading submissions failed to get data!", error);
            this.hasFailed(true);
            this.isLoading(false);
        });
    }

    /*
     * Search criteria management
     */

    addSearchCriterion() {
        this.searchCriteria.push(new SearchCriterion());
    }

    removeSearchCriterion(criterion: SearchCriterion) {
        this.searchCriteria.remove(criterion);
    }

    /** Drop all criteria; if the current results were searched, re-view unfiltered. */
    clearSearch() {
        this.searchCriteria.removeAll();
        this.searchErrors.removeAll();
        if (this.loadedSearchActive()) {
            this.viewSubmissions();
        }
    }

    private serializeSearch(): string {
        if (!this.searchCriteria().length) {
            return "";
        }
        return JSON.stringify({
            combinator: this.searchCombinator(),
            criteria: this.searchCriteria().map((criterion) => criterion.toJson())
        });
    }

    /** Collapse a selection that covers every available model down to "" (all),
     * so equivalent selections share one URL and one history entry. */
    private normalizeSelection(ids: string, available: {id: number}[]): string {
        const list = this.parseIds(ids);
        if (!list.length) {
            return "";
        }
        if (available.length && list.length === available.length) {
            const availableIds: Record<number, boolean> = {};
            available.forEach((model) => availableIds[model.id] = true);
            if (list.every((id: number) => availableIds[id])) {
                return "";
            }
        }
        return list.join(",");
    }

    /*
     * Selection history (persisted per course in localStorage)
     */

    private historyKey(): string {
        return `SUBMISSIONS_FILTER_${this.course.id}_HISTORY`;
    }

    private loadHistory(): HistoryEntry[] {
        try {
            const raw = STORAGE_SERVICE.get(this.historyKey());
            const parsed = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(parsed)) {
                return [];
            }
            return parsed.filter((entry: any) => entry != null &&
                typeof entry.userIds === "string" && typeof entry.assignmentIds === "string");
        } catch (e) {
            return [];
        }
    }

    private pushHistory(userIds: string, assignmentIds: string) {
        const entries = this.history().filter((entry: HistoryEntry) =>
            entry.userIds !== userIds || entry.assignmentIds !== assignmentIds);
        entries.unshift({userIds, assignmentIds});
        this.history(entries.slice(0, HISTORY_LIMIT));
        STORAGE_SERVICE.set(this.historyKey(), JSON.stringify(this.history()));
    }

    /** Compact name for a history entry: the assignment side, unless the entry is
     * really about who ("All assignments" for one student), then the student side.
     * The full "assignments — students" description lives in the tooltip. */
    historyLabel(entry: HistoryEntry): string {
        if (!this.parseIds(entry.assignmentIds).length && this.parseIds(entry.userIds).length) {
            return this.describeSelection(entry.userIds,
                this.server.userStore, "All students", "students");
        }
        return this.describeSelection(entry.assignmentIds,
            this.server.assignmentStore, "All assignments", "assignments");
    }

    /** Full description of a history entry, e.g. "Problem 2 — All students". */
    historyTitle(entry: HistoryEntry): string {
        const assignments = this.describeSelection(entry.assignmentIds,
            this.server.assignmentStore, "All assignments", "assignments");
        const users = this.describeSelection(entry.userIds,
            this.server.userStore, "All students", "students");
        return `${assignments} — ${users}`;
    }

    private describeSelection(ids: string, store: any, allLabel: string, plural: string): string {
        const list = this.parseIds(ids);
        if (!list.length) {
            return allLabel;
        }
        if (list.length === 1) {
            return store.getInstance(list[0]).title();
        }
        return `${list.length} ${plural}`;
    }

    /** Re-view a remembered selection, syncing the selectors to match. */
    applyHistoryEntry(entry: HistoryEntry) {
        this.userApply(entry.userIds);
        this.assignmentApply(entry.assignmentIds);
        this.load(entry.userIds, entry.assignmentIds);
    }

    private parseIds(ids: string): number[] {
        return ids.split(",")
            .filter((id: string) => id.trim() !== "" && !isNaN(parseInt(id, 10)))
            .map((id: string) => parseInt(id, 10));
    }

    /** Keep the address bar shareable, using the same URLs the old page produced. */
    private updateUrl() {
        if (!window.history || !window.history.replaceState) {
            return;
        }
        const base = window.location.pathname;
        let search = "";
        if (this.loadedAssignmentIds().length === 1 && this.loadedUserIds().length !== 1) {
            search = `?criteria=assignment&search_key=${this.loadedAssignmentIds()[0]}`;
        } else if (this.loadedUserIds().length === 1 && this.loadedAssignmentIds().length !== 1) {
            search = `?criteria=student&search_key=${this.loadedUserIds()[0]}`;
        } else {
            const parts: string[] = [];
            if (this.loadedUserIds().length) {
                parts.push(`user_ids=${this.loadedUserIds().join(",")}`);
            }
            if (this.loadedAssignmentIds().length) {
                parts.push(`assignment_ids=${this.loadedAssignmentIds().join(",")}`);
            }
            search = parts.length ? "?" + parts.join("&") : "";
        }
        window.history.replaceState(null, "", base + search);
    }

    /*
     * Row construction
     */

    rolesList(user: User | null): string {
        if (user == null) {
            return "";
        }
        return user.roles().map((role: Role) => cleanRole(role.name())).join(", ");
    }

    isLearner(user: User | null): boolean {
        return this.rolesList(user).includes("Learner");
    }

    private submissionsByKey(): Record<string, FilterSubmissionJson> {
        const map: Record<string, FilterSubmissionJson> = {};
        this.submissions().forEach((submission: FilterSubmissionJson) => {
            map[submission.user_id + "," + submission.assignment_id] = submission;
        });
        return map;
    }

    private makeRow(submission: FilterSubmissionJson | null, user: User | null,
                    assignment: Assignment | null): SubmissionRow {
        return {isGroupHeader: false, submission, user, assignment};
    }

    private makeDisplayRows(): DisplayRow[] {
        if (!this.hasLoaded()) {
            return [];
        }
        let rows: SubmissionRow[];
        const byKey = this.submissionsByKey();
        switch (this.mode()) {
            case "assignment": {
                // One row per user in the chosen set, like the old one-per-student table
                const assignment = this.singleAssignment();
                rows = this.effectiveUsers().map((user: User) =>
                    this.makeRow(byKey[user.id + "," + assignment.id] || null, user, assignment));
                break;
            }
            case "student": {
                // One row per assignment, in (group, title) order
                const user = this.singleUser();
                rows = this.effectiveAssignments().map((assignment: Assignment) =>
                    this.makeRow(byKey[user.id + "," + assignment.id] || null, user, assignment));
                break;
            }
            default: {
                // Sets on both sides: only actual submissions, users then assignments
                rows = this.submissions().map((submission: FilterSubmissionJson) =>
                    this.makeRow(submission,
                        this.server.userStore.getInstance(submission.user_id),
                        this.server.assignmentStore.getInstance(submission.assignment_id)));
                rows.sort((left, right) =>
                    this.server.userStore.sortMethod(left.user, right.user) ||
                    compareAssignmentsByGroup(left.assignment, right.assignment));
            }
        }
        if (this.loadedSearchActive()) {
            // A search asks "which submissions match?" - placeholder rows for
            // students/assignments without a matching submission are just noise.
            rows = rows.filter((row) => row.submission != null);
        }
        if (this.showOnlyLearners() && this.isAssignmentMode()) {
            rows = rows.filter((row) => this.isLearner(row.user));
        }
        if (this.sortIndex() != null) {
            // Sorting removes the group headers, matching the old table
            return this.sortRows(rows);
        }
        if (this.isStudentMode()) {
            return this.insertGroupHeaders(rows);
        }
        return rows;
    }

    private insertGroupHeaders(rows: SubmissionRow[]): DisplayRow[] {
        const result: DisplayRow[] = [];
        let lastGroupId: number | undefined = undefined;
        rows.forEach((row) => {
            const group = row.assignment != null ? row.assignment.group() : null;
            const groupId = group != null ? group.id : null;
            if (groupId !== lastGroupId) {
                result.push({
                    isGroupHeader: true,
                    groupName: group != null ? group.name() : "Ungrouped Assignments",
                    viewGroupUrl: row.submission != null && row.submission.assignment_group_id != null
                        ? this.viewGroupUrl(row) : null
                });
                lastGroupId = groupId;
            }
            result.push(row);
        });
        return result;
    }

    /*
     * Column definitions and sorting
     */

    private makeColumns(): ColumnSpec[] {
        const columns: ColumnSpec[] = [];
        if (this.showAssignmentColumn()) {
            columns.push({label: "Assignment", type: "string",
                sortKey: (row) => row.assignment != null ? row.assignment.title() : ""});
        }
        if (this.showStudentColumns()) {
            columns.push({label: "Student", type: "string",
                sortKey: (row) => row.user != null ? row.user.title() : ""});
            columns.push({label: "Role", type: "string", sortKey: (row) => this.rolesList(row.user)});
        }
        columns.push({label: "Correct/Score", type: "string", sortKey: (row) => this.scoreText(row)});
        columns.push({label: "Submission Status", type: "string",
            sortKey: (row) => row.submission != null ? row.submission.human_submission_status : ""});
        columns.push({label: "Grading Status", type: "string",
            sortKey: (row) => row.submission != null ? row.submission.human_grading_status : ""});
        columns.push({label: "Edits", type: "number",
            sortKey: (row) => row.submission != null ? (row.submission.version || 0) : 0});
        columns.push({label: "Created", type: "string",
            sortKey: (row) => row.submission != null ? row.submission.date_created : ""});
        columns.push({label: "Last Edited", type: "string",
            sortKey: (row) => row.submission != null ? row.submission.date_modified : ""});
        columns.push({label: "Actions", type: "string", sortKey: null});
        return columns;
    }

    sortColumn(index: number) {
        const column = this.columns()[index];
        if (column == null || column.sortKey == null) {
            return;
        }
        const direction = this.sortDirections[index] || "asc";
        this.appliedSortDirection(direction);
        this.sortDirections[index] = direction === "asc" ? "desc" : "asc";
        this.sortIndex(index);
        // Poke displayRows to re-sort even if the same column is clicked again
        this.sortIndex.valueHasMutated();
    }

    private sortRows(rows: SubmissionRow[]): SubmissionRow[] {
        const column = this.columns()[this.sortIndex()];
        if (column == null || column.sortKey == null) {
            return rows;
        }
        const multiplier = this.appliedSortDirection() === "asc" ? 1 : -1;
        return rows.slice().sort((left, right) => {
            const a = column.sortKey(left);
            const b = column.sortKey(right);
            return multiplier * (a > b ? 1 : a < b ? -1 : 0);
        });
    }

    /*
     * Cell helpers (all bound in the template)
     */

    rowClass(row: SubmissionRow): string {
        const submission = row.submission;
        const assignmentType = row.assignment != null ? row.assignment.type() : "";
        // Reading/feedback assignments count as complete, but (like the old table)
        // not for placeholder rows in the one-per-student layout, where the old
        // data rows had no assignment attached.
        const alwaysComplete = (assignmentType === "reading" || assignmentType === "feedback")
            && (submission != null || !this.isAssignmentMode());
        let color = "";
        if ((submission != null && (submission.correct || roundScore(submission.score) >= 100))
                || alwaysComplete) {
            color = "table-success";
        } else if (submission != null && roundScore(submission.score) > 0) {
            color = "table-warning";
        }
        const learner = row.user != null && !this.isLearner(row.user) ? " non-learner-row" : "";
        return color + learner;
    }

    scoreText(row: SubmissionRow): string {
        if (row.submission == null) {
            return "No";
        }
        if (row.submission.correct) {
            // A correct submission's score is just noise; it stays in the tooltip
            return "Yes";
        }
        return `No (${formatScore(row.submission.score)}%)`;
    }

    scoreTitle(row: SubmissionRow): string {
        if (row.submission == null) {
            return "";
        }
        return `score=${formatScore(row.submission.score)}%`;
    }

    gradingIcon(row: SubmissionRow): string {
        return row.submission != null ? this.gradingStatusIcon(row.submission.grading_status) : "";
    }

    private gradingStatusIcon(gradingStatus: string): string {
        if (gradingStatus === "FullyGraded") {
            return `<span class="green-check-mark">&#10004;</span>`;
        } else if (gradingStatus === "Failed") {
            return `<span class="red-x">&#10060;</span>`;
        } else if (gradingStatus === "Pending") {
            return `<span style="color: transparent">*</span>`;
        } else {
            return `<span style="color: transparent">.</span>`;
        }
    }

    prettyDate(dateString: string): string {
        if (!dateString) {
            return "";
        }
        // Timestamps with an explicit zone ("...Z" or "...+00:00") parse as-is;
        // naive ones are UTC and need the Z suffix to be read that way.
        const hasZone = /(Z|[+-]\d{2}:?\d{2})$/.test(dateString);
        return prettyPrintDateTime(hasZone ? dateString : dateString + "Z");
    }

    estimateDuration(row: SubmissionRow, event: Event) {
        if (row.submission != null) {
            (<any>window)["estimateDuration"](event.currentTarget, row.submission.id);
        }
    }

    /** Individual regrade, delegating to the sitewide regrade() helper so the
     * behavior (endpoints, status icon updates, error reporting) is identical. */
    regradeSubmission(row: SubmissionRow, asHuman: boolean, event: Event) {
        (<any>window)["regrade"](event.currentTarget, row.submission.id, !asHuman);
    }

    /** Simulate clicking every regrade button of the given flavor, spaced out
     * exactly like the old bulk regrade. */
    bulkRegrade(asHuman: boolean) {
        const regradeButtons = document.querySelectorAll(`button.re-autograde-btn[data-as-human="${asHuman}"]`);
        $(".overlay").show();
        let finished = 0;
        this.bulkRegradeStatus(`Bulk regrading... (${finished}/${regradeButtons.length})`);
        regradeButtons.forEach((button: HTMLElement, index: number) => {
            setTimeout(() => {
                button.click();
                finished += 1;
                if (finished === regradeButtons.length) {
                    $(".overlay").hide();
                    this.bulkRegradeStatus(`Bulk regrading complete (${finished}/${regradeButtons.length})`);
                } else {
                    this.bulkRegradeStatus(`Bulk regrading... (${finished}/${regradeButtons.length})`);
                }
            }, BULK_REGRADE_WAIT * index);
        });
    }

    /*
     * URL builders (all bound in the template), mirroring the old url_for() links
     */
    private base(): string {
        return window["$URL_ROOT"];
    }

    filterByAssignmentUrl(assignment: Assignment): string {
        return `${this.base()}courses/submissions_filter/${this.course.id}?criteria=assignment&search_key=${assignment.id}`;
    }

    filterByStudentUrl(user: User): string {
        return `${this.base()}courses/submissions_filter/${this.course.id}?criteria=student&search_key=${user.id}`;
    }

    viewSubmissionUrl(row: SubmissionRow): string {
        return `${this.base()}blockpy/view_submission?submission_id=${row.submission.id}&embed=True`;
    }

    viewGroupUrl(row: SubmissionRow): string {
        return `${this.base()}blockpy/view_submissions/${this.course.id}/${row.submission.user_id}/${row.submission.assignment_group_id}?embed=True`;
    }

    downloadSubmissionUrl(row: SubmissionRow, withHistory: boolean): string {
        return `${this.base()}blockpy/load_assignment?assignment_id=${row.assignment.id}&user_id=${row.user.id}`
            + `&course_id=${this.course.id}&force_download=True${withHistory ? "&with_history=True" : ""}&embed=True`;
    }

    historyLogUrl(row: SubmissionRow): string {
        return `${this.base()}blockpy/browse_history?assignment_id=${row.submission.assignment_id}`
            + `&user_id=${row.submission.user_id}&course_id=${this.course.id}`;
    }

    transferCourseUrl(row: SubmissionRow): string {
        return `${this.base()}assignments/transfer_course?submission_id=${row.submission.id}`;
    }

    exportSubmissionsUrl(withHistory: boolean): string {
        return `${this.base()}assignments/export_submissions?assignment_id=${this.singleAssignment().id}`
            + `&course_id=${this.course.id}${withHistory ? "&history=True" : ""}`;
    }

    openAssignmentUrl(): string {
        return `${this.base()}assignments/load?assignment_id=${this.singleAssignment().id}&course_id=${this.course.id}`;
    }

    bulkDownloadEventsUrl(): string {
        return `${this.base()}blockpy/load_history?user_id=${this.singleUser().id}&course_id=${this.course.id}`;
    }
}

ko.components.register("submissions-filter", {
    viewModel: SubmissionsFilter,
    template: SUBMISSIONS_FILTER_HTML
});
