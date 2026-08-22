/**
 * The Course Analytics dashboard: instructor-facing statistics over the
 * course's submissions and their activity counters. Where View Submissions
 * answers "show me these submissions," this page answers "tell me what's
 * going on."
 *
 * It reuses the View Submissions selection machinery — the user/assignment
 * set selectors, display settings, and the criteria search (extended with
 * metric/student/assignment fields) — one control bar that narrows every tab.
 *
 * Data paths, mirroring the backend's performance rules:
 * - Without criteria, tables are fed by `courses/analytics/rollup`: one
 *   aggregate row per assignment and per student, computed in SQL.
 * - With criteria active, the per-submission `courses/analytics/detail`
 *   endpoint (scope-capped server-side) is fetched instead and aggregated
 *   client-side into the same row shape, so every filter narrows every table.
 *
 * Data honesty: a missing metric renders as "—", never 0, and aggregates
 * carry their n. Which metric columns a row shows depends on the assignment
 * type (programming / reading / quiz).
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
import {SearchCriterion, SEARCH_COMBINATORS, ANALYTICS_FIELD_GROUPS,
        flattenFieldGroups} from "../search_criteria";
import {histogramConfig, scatterConfig, binValues, formatSeconds,
        ScatterPoint} from "./charts";

import COURSE_ANALYTICS_HTML from "./analytics.html";

export interface CourseAnalyticsJson {
    server: Server;
    course: Course;
    user: User;
    defaultAssignmentIds: string;
    userIds: string;
    assignmentIds: string;
}

/** Per-metric aggregate from the rollup endpoint (or client-side aggregation). */
export interface RollupMetricStat {
    sum: number;
    n: number;
    median: number | null;
}

/** One aggregate row (per assignment or per student) from `analytics/rollup`. */
export interface RollupRow {
    id: number;
    n: number;
    correct: number;
    mean_score: number | null;
    median_score: number | null;
    median_attempts: number | null;
    last_activity: string | null;
    statuses: Record<string, number>;
    metrics: Record<string, RollupMetricStat>;
}

/** One per-submission row from `analytics/detail`: the submissions-filter
 * encoding plus dates, attempts, and the pivoted counter metrics (metrics
 * with no data are absent, not 0). */
export interface DetailSubmissionJson {
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
    date_started: string | null;
    date_due: string | null;
    attempts: number;
    metrics: Record<string, number>;
}

/** Anything carrying a rollup row: an assignment row or a roster row. */
export interface StatsHolder {
    stats: RollupRow | null;
}

export interface AssignmentStatsRow extends StatsHolder {
    isGroupHeader: false;
    assignment: Assignment;
}

export interface StatsGroupHeaderRow {
    isGroupHeader: true;
    groupName: string;
}

export type AnalyticsDisplayRow = AssignmentStatsRow | StatsGroupHeaderRow;

export interface StudentStatsRow extends StatsHolder {
    user: User;
}

/** One cell of the student progress strip: an assignment and its status color. */
export interface ProgressStripCell {
    assignment: Assignment;
    submission: DetailSubmissionJson | null;
    // A bootstrap background class expressing the status
    cellClass: string;
    title: string;
}

export interface ProgressStripGroup {
    groupName: string;
    cells: ProgressStripCell[];
}

interface AnalyticsColumnSpec {
    label: string;
    type: "string" | "number";
    sortKey: ((row: AssignmentStatsRow) => string | number) | null;
    // Shown as a tooltip on the column header
    help?: string;
}

interface StudentColumnSpec {
    label: string;
    type: "string" | "number";
    sortKey: ((row: StudentStatsRow) => string | number) | null;
    help?: string;
}

const PROGRAMMING_TYPES = ["blockpy", "python", "java", "typescript", "maze"];
const READING_TYPES = ["reading", "textbook", "explanation", "explain"];

export type AnalyticsTab = "overview" | "assignments" | "students" | "exams";

export class CourseAnalytics {
    server: Server;
    course: Course;
    user: User;

    // Selection state (the set selectors write into these)
    userSet: KnockoutObservable<ModelSet>;
    assignmentSet: KnockoutObservable<ModelSet>;
    userDefault: string;
    assignmentDefault: string;
    userSelectMode: KnockoutObservable<SelectMode>;
    assignmentSelectMode: KnockoutObservable<SelectMode>;
    userApply: KnockoutObservable<string>;
    assignmentApply: KnockoutObservable<string>;
    userSelectorReady: KnockoutObservable<boolean>;
    assignmentSelectorReady: KnockoutObservable<boolean>;

    // Search criteria (evaluated server-side on the detail path)
    searchFieldGroups = ANALYTICS_FIELD_GROUPS;
    searchFields = flattenFieldGroups(ANALYTICS_FIELD_GROUPS);
    combinatorOptions = SEARCH_COMBINATORS;
    searchCombinator: KnockoutObservable<string>;
    searchCriteria: ko.ObservableArray<SearchCriterion>;
    searchErrors: ko.ObservableArray<string>;
    loadedSearchActive: ko.Observable<boolean>;

    // The full course rosters, for the "everything" selection
    availableUsers: ko.ObservableArray<User>;
    availableAssignments: ko.ObservableArray<Assignment>;

    // What the last load actually asked for ([] means "everything")
    loadedUserIds: ko.ObservableArray<number>;
    loadedAssignmentIds: ko.ObservableArray<number>;
    assignmentRollup: ko.ObservableArray<RollupRow>;
    studentRollup: ko.ObservableArray<RollupRow>;
    dataAsOf: ko.Observable<string>;

    hasLoaded: ko.Observable<boolean>;
    isLoading: ko.Observable<boolean>;
    hasFailed: ko.Observable<boolean>;
    failureMessage: ko.Observable<string>;

    currentTab: ko.Observable<AnalyticsTab>;

    // Assignment drill-down: the one expanded assignment's per-submission
    // detail, fetched on demand for that assignment only
    expandedAssignmentId: ko.Observable<number>;
    expandedDetail: ko.ObservableArray<DetailSubmissionJson>;
    isDetailLoading: ko.Observable<boolean>;
    detailError: ko.Observable<string>;
    expandedTimeChart: ko.PureComputed<any>;
    expandedRunsChart: ko.PureComputed<any>;
    expandedScatterChart: ko.PureComputed<any>;

    // Student drill-down: one student's submissions across the whole course
    expandedUserId: ko.Observable<number>;
    expandedUserDetail: ko.ObservableArray<DetailSubmissionJson>;
    isUserDetailLoading: ko.Observable<boolean>;
    userDetailError: ko.Observable<string>;
    progressStrip: ko.PureComputed<ProgressStripGroup[]>;

    // Assignments-tab table sorting (mirrors the View Submissions table)
    sortIndex: ko.Observable<number>;
    appliedSortDirection: ko.Observable<string>;
    private sortDirections: Record<number, string>;

    // Students-tab (roster) sorting and display
    showOnlyLearners: ko.Observable<boolean>;
    studentSortIndex: ko.Observable<number>;
    appliedStudentSortDirection: ko.Observable<string>;
    private studentSortDirections: Record<number, string>;

    effectiveAssignments: ko.PureComputed<Assignment[]>;
    effectiveUsers: ko.PureComputed<User[]>;
    columns: ko.PureComputed<AnalyticsColumnSpec[]>;
    assignmentRows: ko.PureComputed<AnalyticsDisplayRow[]>;
    studentColumns: ko.PureComputed<StudentColumnSpec[]>;
    studentRows: ko.PureComputed<StudentStatsRow[]>;
    // Class-median rates, the reference the roster's rate cells color against
    classRateMedians: ko.PureComputed<Record<string, number | null>>;
    querySummary: ko.PureComputed<string>;

    constructor(params: CourseAnalyticsJson) {
        this.server = params.server;
        this.course = params.course;
        this.user = params.user;

        this.userSet = ko.observable<ModelSet>(null);
        this.assignmentSet = ko.observable<ModelSet>(null);
        this.userSelectMode = ko.observable<SelectMode>(null);
        this.assignmentSelectMode = ko.observable<SelectMode>(null);
        this.userApply = ko.observable<string>(null);
        this.assignmentApply = ko.observable<string>(null);
        this.userSelectorReady = ko.observable(false);
        this.assignmentSelectorReady = ko.observable(false);

        this.searchCombinator = ko.observable("and");
        this.searchCriteria = ko.observableArray<SearchCriterion>([]);
        this.searchErrors = ko.observableArray<string>([]);
        this.loadedSearchActive = ko.observable(false);

        // Initial selection: explicit URL parameters win; otherwise all students
        // on the most recent assignment group with activity (embedded by the
        // page route), so first paint answers "how is the current lesson going".
        this.userDefault = params.userIds || "";
        this.assignmentDefault = params.assignmentIds || params.defaultAssignmentIds || "";

        this.availableUsers = ko.observableArray<User>([]);
        this.availableAssignments = ko.observableArray<Assignment>([]);
        this.loadedUserIds = ko.observableArray<number>([]);
        this.loadedAssignmentIds = ko.observableArray<number>([]);
        this.assignmentRollup = ko.observableArray<RollupRow>([]);
        this.studentRollup = ko.observableArray<RollupRow>([]);
        this.dataAsOf = ko.observable("");

        this.hasLoaded = ko.observable(false);
        this.isLoading = ko.observable(false);
        this.hasFailed = ko.observable(false);
        this.failureMessage = ko.observable("");

        this.currentTab = ko.observable<AnalyticsTab>("assignments");

        this.sortIndex = ko.observable<number>(null);
        this.appliedSortDirection = ko.observable("asc");
        this.sortDirections = {};

        this.showOnlyLearners = ko.observable(true);
        this.studentSortIndex = ko.observable<number>(null);
        this.appliedStudentSortDirection = ko.observable("asc");
        this.studentSortDirections = {};

        this.expandedAssignmentId = ko.observable<number>(null);
        this.expandedDetail = ko.observableArray<DetailSubmissionJson>([]);
        this.isDetailLoading = ko.observable(false);
        this.detailError = ko.observable("");
        this.expandedTimeChart = ko.pureComputed(() => this.makeExpandedTimeChart());
        this.expandedRunsChart = ko.pureComputed(() => this.makeExpandedRunsChart());
        this.expandedScatterChart = ko.pureComputed(() => this.makeExpandedScatterChart());

        this.expandedUserId = ko.observable<number>(null);
        this.expandedUserDetail = ko.observableArray<DetailSubmissionJson>([]);
        this.isUserDetailLoading = ko.observable(false);
        this.userDetailError = ko.observable("");
        this.progressStrip = ko.pureComputed<ProgressStripGroup[]>(() => this.makeProgressStrip());

        this.server.userStore.getAllAvailable().then((users: User[]) => {
            this.availableUsers(users);
        });
        this.server.assignmentStore.getAllAvailable().then((assignments: Assignment[]) => {
            this.availableAssignments(assignments);
            this.load(this.userDefault, this.assignmentDefault);
        });

        this.effectiveAssignments = ko.pureComputed<Assignment[]>(() => {
            const chosen = this.loadedAssignmentIds();
            const assignments = chosen.length
                ? chosen.map((id: number) => this.server.assignmentStore.getInstance(id))
                : this.availableAssignments().slice();
            return assignments.sort(compareAssignmentsByGroup);
        });
        this.effectiveUsers = ko.pureComputed<User[]>(() => {
            const chosen = this.loadedUserIds();
            const users = chosen.length
                ? chosen.map((id: number) => this.server.userStore.getInstance(id))
                : this.availableUsers().slice();
            return users.sort(this.server.userStore.sortMethod.bind(this.server.userStore));
        });

        this.columns = ko.pureComputed<AnalyticsColumnSpec[]>(() => this.makeColumns());
        this.assignmentRows = ko.pureComputed<AnalyticsDisplayRow[]>(() => this.makeAssignmentRows());
        this.studentColumns = ko.pureComputed<StudentColumnSpec[]>(() => this.makeStudentColumns());
        this.studentRows = ko.pureComputed<StudentStatsRow[]>(() => this.makeStudentRows());
        this.classRateMedians = ko.pureComputed<Record<string, number | null>>(() => {
            const rates: Record<string, number[]> = {syntax: [], runtime: [], tests: []};
            this.studentRows().forEach((row) => {
                const syntax = this.rate(row, "feedback_syntax_errors", "feedback_total");
                const runtime = this.rate(row, "feedback_runtime_errors", "feedback_total");
                const tests = this.rate(row, "feedback_assertion_successes",
                                        "feedback_assertion_counts");
                if (syntax >= 0) { rates.syntax.push(syntax); }
                if (runtime >= 0) { rates.runtime.push(runtime); }
                if (tests >= 0) { rates.tests.push(tests); }
            });
            return {
                syntax: CourseAnalytics.median(rates.syntax),
                runtime: CourseAnalytics.median(rates.runtime),
                tests: CourseAnalytics.median(rates.tests)
            };
        });

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
    }

    switchTab(tab: AnalyticsTab) {
        this.currentTab(tab);
    }

    /** Reload from the "View analytics" button, using the current sets. */
    viewAnalytics() {
        const userIds = this.userSet() != null ? this.userSet().getIds() : this.userDefault;
        const assignmentIds = this.assignmentSet() != null
            ? this.assignmentSet().getIds() : this.assignmentDefault;
        this.load(userIds, assignmentIds);
    }

    refresh() {
        this.load(this.loadedUserIds().join(","), this.loadedAssignmentIds().join(","));
    }

    load(userIds: string, assignmentIds: string) {
        userIds = this.normalizeSelection(userIds, this.availableUsers());
        assignmentIds = this.normalizeSelection(assignmentIds, this.availableAssignments());
        const search = this.serializeSearch();
        this.isLoading(true);
        this.hasFailed(false);
        const finishLoad = () => {
            this.loadedUserIds(this.parseIds(userIds));
            this.loadedAssignmentIds(this.parseIds(assignmentIds));
            this.loadedSearchActive(search !== "");
            this.sortIndex(null);
            this.sortDirections = {};
            this.expandedAssignmentId(null);
            this.expandedDetail([]);
            this.expandedUserId(null);
            this.expandedUserDetail([]);
            this.hasLoaded(true);
            this.isLoading(false);
            this.updateUrl();
        };
        if (search === "") {
            // No criteria: SQL aggregates only, never per-submission payloads
            ajax_post("courses/analytics/rollup", {
                course_id: this.course.id,
                user_ids: userIds,
                assignment_ids: assignmentIds
            }).then((data: any) => {
                if (!data.success) {
                    this.fail(data.message);
                    return;
                }
                this.assignmentRollup(data.assignments);
                this.studentRollup(data.students);
                this.dataAsOf(data.data_as_of || "");
                this.searchErrors([]);
                finishLoad();
            }).fail((error: any) => this.fail(error?.responseJSON?.message, error));
        } else {
            // Criteria active: fetch the scoped per-submission detail and
            // aggregate client-side, so the filters narrow every table
            ajax_post("courses/analytics/detail", {
                course_id: this.course.id,
                user_ids: userIds,
                assignment_ids: assignmentIds,
                search: search
            }).then((data: any) => {
                if (!data.success) {
                    this.fail(data.message);
                    return;
                }
                const submissions: DetailSubmissionJson[] = data.submissions;
                this.assignmentRollup(this.aggregateDetail(submissions,
                    (submission) => submission.assignment_id));
                this.studentRollup(this.aggregateDetail(submissions,
                    (submission) => submission.user_id));
                this.dataAsOf("");
                this.searchErrors(data.search_errors || []);
                finishLoad();
            }).fail((error: any) => this.fail(error?.responseJSON?.message, error));
        }
    }

    /** `error` may be a jqXHR (HTTP failure) or a thrown Error — jQuery routes
     * exceptions from the .then handler into .fail too, so always log the raw
     * object: it carries the stack or the response body. */
    private fail(message?: string, error?: any) {
        this.isLoading(false);
        this.hasFailed(true);
        this.failureMessage(message ||
            "Loading the analytics failed; more details in the JS console.");
        console.error("Loading analytics failed!", error !== undefined ? error : message);
    }

    /*
     * Client-side aggregation of the detail payload into RollupRow shape
     */

    static median(values: number[]): number | null {
        if (!values.length) {
            return null;
        }
        const sorted = values.slice().sort((a, b) => a - b);
        const middle = Math.floor(sorted.length / 2);
        return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
    }

    private aggregateDetail(submissions: DetailSubmissionJson[],
                            key: (submission: DetailSubmissionJson) => number): RollupRow[] {
        const groups: Record<number, DetailSubmissionJson[]> = {};
        submissions.forEach((submission) => {
            const id = key(submission);
            (groups[id] = groups[id] || []).push(submission);
        });
        return Object.keys(groups).map((id) => {
            const members = groups[parseInt(id, 10)];
            const scores = members.map((s) => s.score).filter((score) => score != null);
            const attempts = members.map((s) => s.attempts).filter((count) => count != null);
            const statuses: Record<string, number> = {};
            members.forEach((s) => {
                statuses[s.submission_status] = (statuses[s.submission_status] || 0) + 1;
            });
            const metrics: Record<string, RollupMetricStat> = {};
            members.forEach((s) => {
                Object.keys(s.metrics || {}).forEach((metric) => {
                    const stat = metrics[metric] = metrics[metric] || {sum: 0, n: 0, median: null};
                    stat.sum += s.metrics[metric];
                    stat.n += 1;
                });
            });
            Object.keys(metrics).forEach((metric) => {
                metrics[metric].median = CourseAnalytics.median(
                    members.filter((s) => metric in (s.metrics || {}))
                           .map((s) => s.metrics[metric]));
            });
            return {
                id: parseInt(id, 10),
                n: members.length,
                correct: members.filter((s) => s.correct).length,
                mean_score: scores.length
                    ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
                median_score: CourseAnalytics.median(scores),
                median_attempts: CourseAnalytics.median(attempts),
                last_activity: members.map((s) => s.date_modified)
                    .reduce((latest, date) => date > latest ? date : latest, ""),
                statuses: statuses,
                metrics: metrics
            };
        });
    }

    /*
     * Search criteria management (same contract as View Submissions)
     */

    addSearchCriterion() {
        this.searchCriteria.push(new SearchCriterion(this.searchFields));
    }

    removeSearchCriterion(criterion: SearchCriterion) {
        this.searchCriteria.remove(criterion);
    }

    clearSearch() {
        this.searchCriteria.removeAll();
        this.searchErrors.removeAll();
        if (this.loadedSearchActive()) {
            this.viewAnalytics();
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

    /*
     * Assignments tab: rows, columns, sorting
     */

    private statsById(): Record<number, RollupRow> {
        const map: Record<number, RollupRow> = {};
        this.assignmentRollup().forEach((row) => {
            map[row.id] = row;
        });
        return map;
    }

    private makeAssignmentRows(): AnalyticsDisplayRow[] {
        if (!this.hasLoaded()) {
            return [];
        }
        const stats = this.statsById();
        let rows: AssignmentStatsRow[] = this.effectiveAssignments()
            .map((assignment) => ({
                isGroupHeader: false as false,
                assignment: assignment,
                stats: stats[assignment.id] || null
            }));
        if (this.loadedSearchActive()) {
            // A search asks "which submissions match?" — assignments with no
            // matching submissions are just noise
            rows = rows.filter((row) => row.stats != null);
        }
        if (this.sortIndex() != null) {
            // Sorting removes the group headers, like the View Submissions table
            return this.sortRows(rows);
        }
        return this.insertGroupHeaders(rows);
    }

    private insertGroupHeaders(rows: AssignmentStatsRow[]): AnalyticsDisplayRow[] {
        const result: AnalyticsDisplayRow[] = [];
        let lastGroupId: number | undefined = undefined;
        rows.forEach((row) => {
            const group = row.assignment != null ? row.assignment.group() : null;
            const groupId = group != null ? group.id : null;
            if (groupId !== lastGroupId) {
                result.push({
                    isGroupHeader: true,
                    groupName: group != null ? group.name() : "Ungrouped Assignments"
                });
                lastGroupId = groupId;
            }
            result.push(row);
        });
        return result;
    }

    private makeColumns(): AnalyticsColumnSpec[] {
        const metricMedian = (row: AssignmentStatsRow, metric: string) => {
            const stat = row.stats != null ? row.stats.metrics[metric] : null;
            return stat != null && stat.median != null ? stat.median : -1;
        };
        return [
            {label: "Assignment", type: "string",
             sortKey: (row) => row.assignment.title()},
            {label: "Type", type: "string",
             sortKey: (row) => row.assignment.type()},
            {label: "Started", type: "number", sortKey: (row) => this.startedCount(row),
             help: "Submissions not still in the never-opened Initialized state, " +
                   "out of the students with a submission row at all"},
            {label: "Ran", type: "number", sortKey: (row) => this.ranCount(row),
             help: "Students with at least one code run that produced feedback"},
            {label: "Correct", type: "number",
             sortKey: (row) => row.stats != null ? row.stats.correct : -1,
             help: "Students whose submission is flagged fully complete"},
            {label: "Completion", type: "number", sortKey: (row) => this.completionFraction(row),
             help: "Correct, as a fraction of the students with a submission row"},
            {label: "Median score", type: "number",
             sortKey: (row) => row.stats != null && row.stats.median_score != null
                 ? row.stats.median_score : -1},
            {label: "Median time", type: "number", sortKey: (row) => this.timeSortKey(row),
             help: "Estimated time on task (a floor estimate); readings show " +
                   "active read and watch time instead"},
            {label: "Median runs", type: "number",
             sortKey: (row) => metricMedian(row, "total_interventions")},
            {label: "Syntax", type: "number",
             sortKey: (row) => this.rate(row, "feedback_syntax_errors", "feedback_total"),
             help: "Runs ending in a syntax error, as a fraction of all feedback runs " +
                   "(struggling with fundamentals or confusing starter code)"},
            {label: "Runtime", type: "number",
             sortKey: (row) => this.rate(row, "feedback_runtime_errors", "feedback_total"),
             help: "Runs ending in a runtime error, as a fraction of all feedback runs " +
                   "(logic or instructions are the problem)"},
            {label: "Tests", type: "number",
             sortKey: (row) => this.rate(row, "feedback_assertion_successes",
                                         "feedback_assertion_counts"),
             help: "Instructor-test assertions passed, as a fraction of assertions run"}
        ];
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
        this.sortIndex.valueHasMutated();
    }

    private sortRows(rows: AssignmentStatsRow[]): AssignmentStatsRow[] {
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
     * Type-aware cell helpers (all bound in the template). Every "—" is a
     * deliberate "no data", never a 0.
     */

    isProgramming(row: AssignmentStatsRow): boolean {
        return PROGRAMMING_TYPES.indexOf(row.assignment.type().toLowerCase()) !== -1;
    }

    isReading(row: AssignmentStatsRow): boolean {
        return READING_TYPES.indexOf(row.assignment.type().toLowerCase()) !== -1;
    }

    isQuiz(row: AssignmentStatsRow): boolean {
        return row.assignment.type().toLowerCase() === "quiz";
    }

    startedCount(row: AssignmentStatsRow): number {
        if (row.stats == null) {
            return -1;
        }
        return row.stats.n - (row.stats.statuses["Initialized"] || 0);
    }

    ranCount(row: AssignmentStatsRow): number {
        if (row.stats == null) {
            return -1;
        }
        const feedback = row.stats.metrics["feedback_total"];
        return feedback != null ? feedback.n : -1;
    }

    completionFraction(row: AssignmentStatsRow): number {
        if (row.stats == null || !row.stats.n) {
            return -1;
        }
        return row.stats.correct / row.stats.n;
    }

    private metricStat(row: StatsHolder, metric: string): RollupMetricStat | null {
        return row.stats != null ? row.stats.metrics[metric] || null : null;
    }

    private rate(row: StatsHolder, numerator: string, denominator: string): number {
        const top = this.metricStat(row, numerator);
        const bottom = this.metricStat(row, denominator);
        if (top == null || bottom == null || !bottom.sum) {
            return -1;
        }
        return top.sum / bottom.sum;
    }

    private timeSortKey(row: AssignmentStatsRow): number {
        if (this.isReading(row)) {
            const read = this.metricStat(row, "total_active_read_time");
            // Milliseconds, normalized to seconds so mixed tables sort sensibly
            return read != null && read.median != null ? read.median / 1000 : -1;
        }
        const time = this.metricStat(row, "total_time_spent");
        return time != null && time.median != null ? time.median : -1;
    }

    /** "≥ 24 min (n=41)" — honest about the floor-estimate semantics. */
    static formatDuration(seconds: number): string {
        if (seconds < 60) {
            return `${Math.round(seconds)} s`;
        }
        if (seconds < 5400) {
            return `${Math.round(seconds / 60)} min`;
        }
        const hours = Math.floor(seconds / 3600);
        return `${hours} h ${Math.round((seconds % 3600) / 60)} min`;
    }

    countText(value: number): string {
        return value < 0 ? "—" : String(value);
    }

    completionText(row: AssignmentStatsRow): string {
        const fraction = this.completionFraction(row);
        if (fraction < 0) {
            return "—";
        }
        return `${Math.round(fraction * 100)}% of ${row.stats.n}`;
    }

    scoreText(row: AssignmentStatsRow): string {
        if (row.stats == null) {
            return "—";
        }
        if (row.stats.median_score != null) {
            return String(Math.round(row.stats.median_score * 10) / 10);
        }
        if (row.stats.mean_score != null) {
            return `${Math.round(row.stats.mean_score * 10) / 10} (mean)`;
        }
        return "—";
    }

    timeText(row: AssignmentStatsRow): string {
        if (this.isReading(row)) {
            const read = this.metricStat(row, "total_active_read_time");
            const watch = this.metricStat(row, "total_watch_time");
            const parts: string[] = [];
            if (read != null && read.median != null) {
                parts.push(`read ≥ ${CourseAnalytics.formatDuration(read.median / 1000)}`);
            }
            if (watch != null && watch.median != null) {
                parts.push(`watch ${CourseAnalytics.formatDuration(watch.median / 1000)}`);
            }
            return parts.length ? parts.join(" · ") : "—";
        }
        const time = this.metricStat(row, "total_time_spent");
        if (time == null || time.median == null) {
            return "—";
        }
        return `≥ ${CourseAnalytics.formatDuration(time.median)}`;
    }

    /** The n behind the time median, so aggregates state their n. */
    timeTitle(row: AssignmentStatsRow): string {
        const metric = this.isReading(row) ? "total_active_read_time" : "total_time_spent";
        const stat = this.metricStat(row, metric);
        return stat != null ? `median of ${stat.n} students with data` : "no students with data";
    }

    runsText(row: AssignmentStatsRow): string {
        if (this.isQuiz(row)) {
            return row.stats != null && row.stats.median_attempts != null
                ? `${row.stats.median_attempts} attempts` : "—";
        }
        if (!this.isProgramming(row)) {
            return "—";
        }
        const runs = this.metricStat(row, "total_interventions");
        return runs != null && runs.median != null ? String(runs.median) : "—";
    }

    rateText(row: AssignmentStatsRow, numerator: string, denominator: string): string {
        if (!this.isProgramming(row)) {
            return "—";
        }
        const value = this.rate(row, numerator, denominator);
        return value < 0 ? "—" : `${Math.round(value * 100)}%`;
    }

    /*
     * Assignment drill-down: fetched on demand for the one expanded assignment
     */

    toggleAssignmentDetail(row: AssignmentStatsRow) {
        if (this.expandedAssignmentId() === row.assignment.id) {
            this.expandedAssignmentId(null);
            this.expandedDetail([]);
            return;
        }
        this.expandedAssignmentId(row.assignment.id);
        this.expandedDetail([]);
        this.detailError("");
        this.isDetailLoading(true);
        ajax_post("courses/analytics/detail", {
            course_id: this.course.id,
            user_ids: this.loadedUserIds().join(","),
            assignment_ids: String(row.assignment.id),
            search: this.serializeSearch()
        }).then((data: any) => {
            this.isDetailLoading(false);
            if (!data.success) {
                this.detailError(data.message || "Loading the drill-down failed.");
                return;
            }
            // The user may have expanded a different row while this was in flight
            if (this.expandedAssignmentId() === row.assignment.id) {
                this.expandedDetail(data.submissions);
            }
        }).fail((error: any) => {
            this.isDetailLoading(false);
            this.detailError(error?.responseJSON?.message || "Loading the drill-down failed.");
        });
    }

    expandedAssignment(): Assignment | null {
        const id = this.expandedAssignmentId();
        return id != null ? this.server.assignmentStore.getInstance(id) : null;
    }

    private expandedType(): string {
        const assignment = this.expandedAssignment();
        return assignment != null ? assignment.type().toLowerCase() : "";
    }

    /** Values of one pivoted metric across the expanded detail; submissions
     * with no data for the metric are excluded, never counted as 0. */
    private expandedMetricValues(metric: string): number[] {
        return this.expandedDetail()
            .filter((submission) => metric in (submission.metrics || {}))
            .map((submission) => submission.metrics[metric]);
    }

    private makeExpandedTimeChart(): any {
        if (READING_TYPES.indexOf(this.expandedType()) !== -1) {
            // Milliseconds for read time
            const values = this.expandedMetricValues("total_active_read_time")
                .map((ms) => ms / 1000);
            return values.length
                ? histogramConfig(binValues(values, 8, formatSeconds), "Active read time")
                : null;
        }
        const values = this.expandedMetricValues("total_time_spent");
        return values.length
            ? histogramConfig(binValues(values, 8, formatSeconds), "Time on task (floor estimate)")
            : null;
    }

    private makeExpandedRunsChart(): any {
        if (this.expandedType() === "quiz") {
            const attempts = this.expandedDetail()
                .map((submission) => submission.attempts)
                .filter((count) => count != null && count > 0);
            return attempts.length
                ? histogramConfig(binValues(attempts, 8, (v) => String(Math.round(v))), "Attempts")
                : null;
        }
        const values = this.expandedMetricValues("total_interventions");
        return values.length
            ? histogramConfig(binValues(values, 8, (v) => String(Math.round(v))), "Runs")
            : null;
    }

    private makeExpandedScatterChart(): any {
        const timeMetric = READING_TYPES.indexOf(this.expandedType()) !== -1
            ? "total_active_read_time" : "total_time_spent";
        const divisor = timeMetric === "total_active_read_time" ? 60000 : 60;
        const points: ScatterPoint[] = this.expandedDetail()
            .filter((submission) => timeMetric in (submission.metrics || {})
                && submission.score != null)
            .map((submission) => ({
                x: submission.metrics[timeMetric] / divisor,
                y: submission.score,
                label: this.server.userStore.getInstance(submission.user_id).title()
            }));
        return points.length
            ? scatterConfig(points, "Time (minutes)", "Score")
            : null;
    }

    /** How many of the expanded detail rows actually have counter data. */
    expandedDataCount(): number {
        return this.expandedDetail()
            .filter((submission) => Object.keys(submission.metrics || {}).length > 0).length;
    }

    /*
     * Student drill-down: the whole-course picture for one student, before
     * office hours — a progress strip across every group, plus any elevated
     * anomaly signals. Fetched for that one student only.
     */

    toggleStudentDetail(row: StudentStatsRow) {
        if (this.expandedUserId() === row.user.id) {
            this.expandedUserId(null);
            this.expandedUserDetail([]);
            return;
        }
        this.expandedUserId(row.user.id);
        this.expandedUserDetail([]);
        this.userDetailError("");
        this.isUserDetailLoading(true);
        ajax_post("courses/analytics/detail", {
            course_id: this.course.id,
            // The whole course for this one student, deliberately ignoring the
            // assignment selection: the point is the overall picture
            user_ids: String(row.user.id)
        }).then((data: any) => {
            this.isUserDetailLoading(false);
            if (!data.success) {
                this.userDetailError(data.message || "Loading the student detail failed.");
                return;
            }
            if (this.expandedUserId() === row.user.id) {
                this.expandedUserDetail(data.submissions);
            }
        }).fail((error: any) => {
            this.isUserDetailLoading(false);
            this.userDetailError(error?.responseJSON?.message
                || "Loading the student detail failed.");
        });
    }

    private makeProgressStrip(): ProgressStripGroup[] {
        if (this.expandedUserId() == null) {
            return [];
        }
        const byAssignment: Record<number, DetailSubmissionJson> = {};
        this.expandedUserDetail().forEach((submission) => {
            byAssignment[submission.assignment_id] = submission;
        });
        const groups: ProgressStripGroup[] = [];
        let current: ProgressStripGroup = null;
        this.availableAssignments().slice().sort(compareAssignmentsByGroup)
            .forEach((assignment) => {
                const group = assignment.group();
                const groupName = group != null ? group.name() : "Ungrouped Assignments";
                if (current == null || current.groupName !== groupName) {
                    current = {groupName, cells: []};
                    groups.push(current);
                }
                const submission = byAssignment[assignment.id] || null;
                let cellClass = "bg-light";
                let status = "not started";
                if (submission != null) {
                    if (submission.correct) {
                        cellClass = "bg-success";
                        status = "complete";
                    } else if (submission.score > 0) {
                        cellClass = "bg-warning";
                        status = `score ${submission.score}`;
                    } else if (submission.submission_status !== "Initialized") {
                        cellClass = "bg-info";
                        status = "started";
                    } else {
                        cellClass = "bg-secondary";
                        status = "opened, never started";
                    }
                }
                current.cells.push({
                    assignment, submission, cellClass,
                    title: `${assignment.title()}: ${status}`
                });
            });
        return groups;
    }

    progressCellUrl(cell: ProgressStripCell): string {
        if (cell.submission == null) {
            return null;
        }
        return `${this.base()}blockpy/view_submission?submission_id=${cell.submission.id}&embed=True`;
    }

    /** Neutral anomaly counts (pastes, emoji, tab switches) summed across the
     * student's submissions — signals for a closer look, never verdicts. */
    studentAnomaliesText(): string {
        const totals: Record<string, number> = {pastes: 0, emojis: 0, window_visibility_changes: 0};
        this.expandedUserDetail().forEach((submission) => {
            Object.keys(totals).forEach((metric) => {
                totals[metric] += (submission.metrics || {})[metric] || 0;
            });
        });
        const parts: string[] = [];
        if (totals.pastes > 0) {
            parts.push(`${totals.pastes} paste events`);
        }
        if (totals.emojis > 0) {
            parts.push(`emoji seen in code (${totals.emojis}, re-counted across edits)`);
        }
        if (totals.window_visibility_changes > 0) {
            parts.push(`${totals.window_visibility_changes} tab switches`);
        }
        return parts.join(" · ");
    }

    /*
     * Students tab: the roster, one row per student over the selected assignments
     */

    rolesList(user: User): string {
        return user.roles().map((role: Role) => cleanRole(role.name())).join(", ");
    }

    isLearner(user: User): boolean {
        return this.rolesList(user).includes("Learner");
    }

    private studentStatsById(): Record<number, RollupRow> {
        const map: Record<number, RollupRow> = {};
        this.studentRollup().forEach((row) => {
            map[row.id] = row;
        });
        return map;
    }

    private makeStudentRows(): StudentStatsRow[] {
        if (!this.hasLoaded()) {
            return [];
        }
        const stats = this.studentStatsById();
        let rows: StudentStatsRow[] = this.effectiveUsers().map((user) => ({
            user: user,
            stats: stats[user.id] || null
        }));
        if (this.showOnlyLearners()) {
            rows = rows.filter((row) => this.isLearner(row.user));
        }
        if (this.loadedSearchActive()) {
            rows = rows.filter((row) => row.stats != null);
        }
        if (this.studentSortIndex() != null) {
            rows = this.sortStudentRows(rows);
        }
        return rows;
    }

    private makeStudentColumns(): StudentColumnSpec[] {
        return [
            {label: "Student", type: "string", sortKey: (row) => row.user.title()},
            {label: "Role", type: "string", sortKey: (row) => this.rolesList(row.user)},
            {label: "Correct", type: "number",
             sortKey: (row) => row.stats != null ? row.stats.correct : -1,
             help: "Selected assignments flagged fully complete"},
            {label: "Completion", type: "number",
             sortKey: (row) => this.studentCompletionFraction(row),
             help: "Correct, as a fraction of the selected assignments"},
            {label: "Mean score", type: "number",
             sortKey: (row) => row.stats != null && row.stats.mean_score != null
                 ? row.stats.mean_score : -1},
            {label: "Total time", type: "number",
             sortKey: (row) => {
                 const time = this.metricStat(row, "total_time_spent");
                 return time != null ? time.sum : -1;
             },
             help: "Estimated time on task across the selected assignments (a floor estimate)"},
            {label: "Syntax", type: "number",
             sortKey: (row) => this.rate(row, "feedback_syntax_errors", "feedback_total"),
             help: "Colored against the class median, not an absolute threshold"},
            {label: "Runtime", type: "number",
             sortKey: (row) => this.rate(row, "feedback_runtime_errors", "feedback_total"),
             help: "Colored against the class median, not an absolute threshold"},
            {label: "Tests", type: "number",
             sortKey: (row) => this.rate(row, "feedback_assertion_successes",
                                         "feedback_assertion_counts"),
             help: "Instructor-test assertions passed; colored against the class median"},
            {label: "Last activity", type: "string",
             sortKey: (row) => row.stats != null && row.stats.last_activity != null
                 ? row.stats.last_activity : ""},
            {label: "Actions", type: "string", sortKey: null}
        ];
    }

    sortStudentColumn(index: number) {
        const column = this.studentColumns()[index];
        if (column == null || column.sortKey == null) {
            return;
        }
        const direction = this.studentSortDirections[index] || "asc";
        this.appliedStudentSortDirection(direction);
        this.studentSortDirections[index] = direction === "asc" ? "desc" : "asc";
        this.studentSortIndex(index);
        this.studentSortIndex.valueHasMutated();
    }

    private sortStudentRows(rows: StudentStatsRow[]): StudentStatsRow[] {
        const column = this.studentColumns()[this.studentSortIndex()];
        if (column == null || column.sortKey == null) {
            return rows;
        }
        const multiplier = this.appliedStudentSortDirection() === "asc" ? 1 : -1;
        return rows.slice().sort((left, right) => {
            const a = column.sortKey(left);
            const b = column.sortKey(right);
            return multiplier * (a > b ? 1 : a < b ? -1 : 0);
        });
    }

    studentCompletionFraction(row: StudentStatsRow): number {
        const total = this.effectiveAssignments().length;
        if (row.stats == null || !total) {
            return -1;
        }
        return row.stats.correct / total;
    }

    studentCompletionText(row: StudentStatsRow): string {
        const fraction = this.studentCompletionFraction(row);
        if (fraction < 0) {
            return "—";
        }
        return `${row.stats.correct}/${this.effectiveAssignments().length}`
            + ` (${Math.round(fraction * 100)}%)`;
    }

    studentScoreText(row: StudentStatsRow): string {
        if (row.stats == null || row.stats.mean_score == null) {
            return "—";
        }
        return String(Math.round(row.stats.mean_score * 10) / 10);
    }

    totalTimeText(row: StudentStatsRow): string {
        const time = this.metricStat(row, "total_time_spent");
        if (time == null) {
            return "—";
        }
        return `≥ ${CourseAnalytics.formatDuration(time.sum)}`;
    }

    studentRateText(row: StudentStatsRow, numerator: string, denominator: string): string {
        const value = this.rate(row, numerator, denominator);
        return value < 0 ? "—" : `${Math.round(value * 100)}%`;
    }

    /** Color a roster rate cell relative to the class median: elevated error
     * rates (or depressed success rates) get flagged, never absolute cutoffs. */
    studentRateClass(row: StudentStatsRow, kind: "syntax" | "runtime" | "tests"): string {
        const pairs: Record<string, [string, string]> = {
            syntax: ["feedback_syntax_errors", "feedback_total"],
            runtime: ["feedback_runtime_errors", "feedback_total"],
            tests: ["feedback_assertion_successes", "feedback_assertion_counts"]
        };
        const value = this.rate(row, pairs[kind][0], pairs[kind][1]);
        const median = this.classRateMedians()[kind];
        if (value < 0 || median == null) {
            return "";
        }
        if (kind === "tests") {
            return value < median * 0.5 ? "text-danger font-weight-bold" : "";
        }
        return value > median * 1.5 && value > 0.1 ? "text-danger font-weight-bold" : "";
    }

    studentRateTitle(row: StudentStatsRow, kind: "syntax" | "runtime" | "tests"): string {
        const median = this.classRateMedians()[kind];
        return median != null ? `class median ${Math.round(median * 100)}%` : "";
    }

    lastActivityText(row: StudentStatsRow): string {
        if (row.stats == null || !row.stats.last_activity) {
            return "—";
        }
        return prettyPrintDateTime(row.stats.last_activity);
    }

    submissionsUserUrl(row: StudentStatsRow): string {
        return `${this.base()}courses/submissions_user/${this.course.id}/${row.user.id}`;
    }

    viewStudentSubmissionsUrl(row: StudentStatsRow): string {
        return `${this.base()}courses/submissions_filter/${this.course.id}`
            + `?criteria=student&search_key=${row.user.id}`;
    }

    /*
     * Selection utilities (same behavior as View Submissions)
     */

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

    private parseIds(ids: string): number[] {
        return ids.split(",")
            .filter((id: string) => id.trim() !== "" && !isNaN(parseInt(id, 10)))
            .map((id: string) => parseInt(id, 10));
    }

    /** Keep the address bar shareable with co-instructors and TAs. */
    private updateUrl() {
        if (!window.history || !window.history.replaceState) {
            return;
        }
        const parts: string[] = [];
        if (this.loadedUserIds().length) {
            parts.push(`user_ids=${this.loadedUserIds().join(",")}`);
        }
        if (this.loadedAssignmentIds().length) {
            parts.push(`assignment_ids=${this.loadedAssignmentIds().join(",")}`);
        }
        window.history.replaceState(null, "",
            window.location.pathname + (parts.length ? "?" + parts.join("&") : ""));
    }

    /*
     * Cross-links into View Submissions (pre-filtered to the same selection)
     */

    private base(): string {
        return window.location.href.slice(0, window.location.href.indexOf("courses/"));
    }

    viewSubmissionsUrl(): string {
        const parts: string[] = [];
        if (this.loadedUserIds().length) {
            parts.push(`user_ids=${this.loadedUserIds().join(",")}`);
        }
        if (this.loadedAssignmentIds().length) {
            parts.push(`assignment_ids=${this.loadedAssignmentIds().join(",")}`);
        }
        return `${this.base()}courses/submissions_filter/${this.course.id}`
            + (parts.length ? "?" + parts.join("&") : "");
    }

    viewAssignmentSubmissionsUrl(row: AssignmentStatsRow): string {
        return `${this.base()}courses/submissions_filter/${this.course.id}`
            + `?criteria=assignment&search_key=${row.assignment.id}`;
    }
}

ko.components.register("course-analytics", {
    viewModel: CourseAnalytics,
    template: COURSE_ANALYTICS_HTML
});
