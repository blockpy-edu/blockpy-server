/**
 * The Assignment Manager is the instructor-facing interface for organizing a course's
 * assignments and assignment groups. It replaces the old server-rendered
 * `templates/courses/assignments.html` page, keeping all of its features (creating
 * assignments and groups, moving assignments between groups, renaming/deleting/forking
 * groups, deleting/forking/exporting assignments, viewing submissions) while adding
 * sorting, searching, and flat-vs-grouped display controls.
 *
 * Data comes from the course-scoped `courses/manage_assignments/get` endpoint, which
 * only returns the current course's assignments, groups, and memberships.
 */
import * as ko from 'knockout';
import {Server} from "../../services/server";
import {Course} from "../../models/course";
import {User} from "../../models/user";
import {AssignmentGroup, AssignmentGroupJson} from "../../models/assignment_group";
import {Assignment, AssignmentJson} from "../../models/assignment";
import {ajax_get, ajax_post, showOverlay, hideOverlay} from "../../services/ajax";

import ASSIGNMENT_MANAGER_HTML from "./assignment_manager.html";
import ASSIGNMENT_MANAGER_MODALS_HTML from "./modals.html";

export interface AssignmentManagerJson {
    server: Server;
    course: Course;
    user: User;
}

interface MembershipJson {
    assignment_id: number;
    assignment_group_id: number;
    position: number;
}

export type GroupSortCriteria = "name" | "url" | "date_created" | "date_modified";

export const SORT_OPTIONS: { key: GroupSortCriteria, label: string }[] = [
    {key: "name", label: "Name"},
    {key: "url", label: "URL"},
    {key: "date_created", label: "Date Created"},
    {key: "date_modified", label: "Date Modified"}
];

import {naturalCompare} from "../../services/plugins";
export {naturalCompare};

/** Strip HTML from instructions without loading any of its resources. */
function stripHtmlTags(html: string): string {
    if (!html) {
        return "";
    }
    return new DOMParser().parseFromString(html, "text/html").body.textContent || "";
}

/** Font Awesome icon for each assignment type, to make types recognizable at a glance. */
const TYPE_ICONS: Record<string, string> = {
    blockpy: "fa-puzzle-piece",
    reading: "fa-book-open",
    textbook: "fa-book",
    quiz: "fa-question-circle",
    typescript: "fa-code",
    java: "fa-coffee",
    explain: "fa-chalkboard-teacher",
    feedback: "fa-comment-dots",
    maze: "fa-gamepad"
};
const DEFAULT_TYPE_ICON = "fa-file-alt";

const DESCRIPTION_LENGTH = 255;

function truncate(text: string, limit: number = DESCRIPTION_LENGTH): string {
    return text.length > limit ? text.slice(0, limit) + "…" : text;
}

function parseJsonQuietly(raw: string): any {
    try {
        return JSON.parse(raw || "{}") || {};
    } catch (e) {
        return {};
    }
}

export interface ReadingSummary {
    header: string;
    summary: string;
    slides: boolean;
    video: boolean;
    smallLayout: boolean;
}

export interface QuizSummary {
    questionCount: number;
    typeCounts: string[];
    gradeMode: string;
    feedbackType: string;
    questionNames: string;
    readingId: number | string | null;
    feedbackId: number | string | null;
}

export interface DisplayGroup {
    group: AssignmentGroup | null;
    title: string;
    assignments: Assignment[];
}

export class AssignmentManager {
    server: Server;
    course: Course;
    user: User;

    // Canonical data for this course
    assignments: ko.ObservableArray<Assignment>;
    groups: ko.ObservableArray<AssignmentGroup>;

    // Display controls
    sortBy: ko.Observable<GroupSortCriteria>;
    sortDescending: ko.Observable<boolean>;
    groupByGroup: ko.Observable<boolean>;
    filterText: ko.Observable<string>;
    sortOptions = SORT_OPTIONS;

    isLoading: ko.Observable<boolean>;
    errorMessage: ko.Observable<string>;

    sortedGroups: ko.PureComputed<AssignmentGroup[]>;
    displayGroups: ko.PureComputed<DisplayGroup[]>;
    groupSelectOptions: ko.PureComputed<{ id: number, name: string }[]>;
    countLabel: ko.PureComputed<string>;

    // Creation modal fields
    createAssignmentType: ko.Observable<string>;
    createAssignmentName: ko.Observable<string>;
    createAssignmentUrl: ko.Observable<string>;
    createAssignmentGroupId: ko.Observable<number>;
    createAssignmentLevel: ko.Observable<string>;
    createGroupName: ko.Observable<string>;
    createGroupUrl: ko.Observable<string>;

    constructor(params: AssignmentManagerJson) {
        this.server = params.server;
        this.course = params.course;
        this.user = params.user;

        this.assignments = ko.observableArray<Assignment>([]);
        this.groups = ko.observableArray<AssignmentGroup>([]);

        this.sortBy = ko.observable<GroupSortCriteria>("name");
        this.sortDescending = ko.observable(false);
        this.groupByGroup = ko.observable(true);
        this.filterText = ko.observable("");

        this.isLoading = ko.observable(true);
        this.errorMessage = ko.observable("");

        this.createAssignmentType = ko.observable("BlockPy");
        this.createAssignmentName = ko.observable("Day 1 - #1.1");
        this.createAssignmentUrl = ko.observable("unique_name");
        this.createAssignmentGroupId = ko.observable(-1);
        this.createAssignmentLevel = ko.observable("1");
        this.createGroupName = ko.observable("Day X - ");
        this.createGroupUrl = ko.observable("unique_group");

        this.sortedGroups = ko.pureComputed<AssignmentGroup[]>(() => {
            const key = this.sortBy();
            const sorted = this.groups().slice().sort((left, right) => {
                switch (key) {
                    case "url": return naturalCompare(left.url(), right.url());
                    case "date_created": return (left.dateCreated() || "").localeCompare(right.dateCreated() || "");
                    case "date_modified": return (left.dateModified() || "").localeCompare(right.dateModified() || "");
                    default: return naturalCompare(left.name(), right.name());
                }
            });
            return this.sortDescending() ? sorted.reverse() : sorted;
        });

        this.groupSelectOptions = ko.pureComputed(() =>
            [{id: -1, name: "Ungrouped Assignments"}].concat(
                this.sortedGroups().map((group) => ({id: group.id, name: group.name()}))));

        this.displayGroups = ko.pureComputed<DisplayGroup[]>(() => this.makeDisplayGroups());

        this.countLabel = ko.pureComputed<string>(() => {
            const total = this.assignments().length;
            const shown = this.filteredAssignments().length;
            return shown === total ? `${total} assignments` : `Showing ${shown} of ${total} assignments`;
        });

        this.load();
    }

    /** (Re)load all of this course's assignments, groups, and memberships. */
    load(): Promise<void> {
        this.isLoading(true);
        return new Promise((resolve) => {
            ajax_get("courses/manage_assignments/get", {course_id: this.course.id}).then((data: any) => {
                if (data.success) {
                    const groups: AssignmentGroup[] = data.groups.map(
                        (json: AssignmentGroupJson) => this.server.assignmentGroupStore.newInstance(json));
                    const assignments: Assignment[] = data.assignments.map(
                        (json: AssignmentJson) => this.server.assignmentStore.newInstance(json));
                    const groupsById: Record<number, AssignmentGroup> = {};
                    groups.forEach((group) => groupsById[group.id] = group);
                    const membershipMap: Record<number, number> = {};
                    (data.memberships || []).forEach((membership: MembershipJson) => {
                        membershipMap[membership.assignment_id] = membership.assignment_group_id;
                    });
                    assignments.forEach((assignment) => {
                        assignment.group(groupsById[membershipMap[assignment.id]] || null);
                    });
                    this.groups(groups);
                    this.assignments(assignments);
                    this.errorMessage("");
                } else {
                    this.errorMessage(data.message || "Failed to load assignments.");
                }
                this.isLoading(false);
                resolve();
            }).catch((error: any) => {
                this.errorMessage("Failed to load assignments: " + (error.statusText || error));
                this.isLoading(false);
                resolve();
            });
        });
    }

    filteredAssignments(): Assignment[] {
        const needle = this.filterText().trim().toLowerCase();
        if (!needle) {
            return this.assignments();
        }
        return this.assignments().filter((assignment) =>
            (assignment.title() || "").toLowerCase().includes(needle) ||
            (assignment.url() || "").toLowerCase().includes(needle) ||
            (assignment.type() || "").toLowerCase().includes(needle));
    }

    /** Assignments are always presented in the order students see them: alphabetically by title. */
    sortAssignmentsByTitle(assignments: Assignment[]): Assignment[] {
        return assignments.slice().sort((left, right) => naturalCompare(left.title(), right.title()));
    }

    private makeDisplayGroups(): DisplayGroup[] {
        const filtered = this.filteredAssignments();
        const isFiltering = this.filterText().trim() !== "";
        if (!this.groupByGroup()) {
            return [{group: null, title: "All Assignments", assignments: this.sortAssignmentsByTitle(filtered)}];
        }
        const result: DisplayGroup[] = this.sortedGroups().map((group) => ({
            group: group,
            title: group.name(),
            assignments: this.sortAssignmentsByTitle(filtered.filter(
                (assignment) => assignment.group() != null && assignment.group().id === group.id))
        }));
        const ungrouped = this.sortAssignmentsByTitle(filtered.filter((assignment) => assignment.group() == null));
        if (ungrouped.length) {
            result.push({group: null, title: "Ungrouped Assignments", assignments: ungrouped});
        }
        // While searching, collapse groups with no matches
        return isFiltering ? result.filter((displayGroup) => displayGroup.assignments.length > 0) : result;
    }

    toggleSortDirection() {
        this.sortDescending(!this.sortDescending());
    }

    shortInstructions(assignment: Assignment): string {
        return truncate(stripHtmlTags(assignment.instructions()));
    }

    typeIcon(assignment: Assignment): string {
        return TYPE_ICONS[(assignment.type() || "").toLowerCase()] || DEFAULT_TYPE_ICON;
    }

    /** CSS class that colors the type icon and badge per assignment type. */
    typeColorClass(assignment: Assignment): string {
        const type = (assignment.type() || "").toLowerCase();
        return "assignment-type-" + (TYPE_ICONS[type] ? type : "default");
    }

    isReading(assignment: Assignment): boolean {
        return (assignment.type() || "").toLowerCase() === "reading";
    }

    isQuiz(assignment: Assignment): boolean {
        return (assignment.type() || "").toLowerCase() === "quiz";
    }

    /** Summarize a reading from its additional settings (header, summary, content badges). */
    readingSummary(assignment: Assignment): ReadingSummary {
        const settings = parseJsonQuietly(assignment.settings());
        let summary = truncate(stripHtmlTags(settings.summary || ""));
        if (!summary) {
            summary = this.shortInstructions(assignment);
        }
        const video = settings.video instanceof Object
            ? Object.keys(settings.video).length > 0 : !!settings.video;
        return {
            header: settings.header || "",
            summary: summary,
            slides: !!settings.slides,
            video: video,
            smallLayout: !!settings.small_layout
        };
    }

    /** Summarize a quiz from its instructions JSON (question counts/types, modes, links). */
    quizSummary(assignment: Assignment): QuizSummary {
        const instructions = parseJsonQuietly(assignment.instructions());
        const questions = instructions.questions || {};
        const settings = instructions.settings || {};
        const names = Object.keys(questions);
        const countsByType: Record<string, number> = {};
        names.forEach((name) => {
            const type = ((questions[name] || {}).type || "unknown")
                .replace(/_question$/, "").replace(/_/g, " ");
            countsByType[type] = (countsByType[type] || 0) + 1;
        });
        return {
            questionCount: names.length,
            typeCounts: Object.keys(countsByType).sort().map(
                (type) => `${countsByType[type]} ${type}`),
            gradeMode: (settings.gradeMode || "QUIZ").toLowerCase() === "survey" ? "Survey" : "Quiz",
            feedbackType: (settings.feedbackType || "IMMEDIATE").toLowerCase() + " feedback",
            questionNames: truncate(names.join(", ")),
            readingId: settings.readingId != null ? settings.readingId : null,
            feedbackId: settings.feedbackId != null ? settings.feedbackId : null
        };
    }

    /** Subtle status badges shown at the far right of each assignment row. */
    assignmentFlags(assignment: Assignment): string[] {
        const flags: string[] = [];
        if (assignment.subordinate()) {
            flags.push("subordinate");
        }
        if (assignment.hidden()) {
            flags.push("hidden");
        }
        if (assignment.public()) {
            flags.push("public");
        }
        if ((assignment.ipRanges() || "").trim()) {
            flags.push("IP locked");
        }
        return flags;
    }

    /*
     * URL builders (all bound in the template)
     */
    private base(): string {
        return window["$URL_ROOT"];
    }

    editAssignmentUrl(assignment: Assignment): string {
        return `${this.base()}assignments/load?assignment_id=${assignment.id}&course_id=${this.course.id}`;
    }

    openAssignmentUrl(assignment: Assignment): string {
        return assignment.url()
            ? `${this.base()}assignments/load?assignment_url=${encodeURIComponent(assignment.url())}`
            : `${this.base()}assignments/load?assignment_id=${assignment.id}`;
    }

    exportAssignmentUrl(assignment: Assignment): string {
        return `${this.base()}assignments/export?assignment_id=${assignment.id}&course_id=${this.course.id}`;
    }

    submissionsUrl(assignment: Assignment): string {
        return `${this.base()}courses/submissions_filter/${this.course.id}?criteria=assignment&search_key=${assignment.id}`;
    }

    viewGroupUrl(group: AssignmentGroup): string {
        return `${this.base()}assignments/load?course_id=${this.course.id}&assignment_group_id=${group.id}`;
    }

    editSecurityUrl(group: AssignmentGroup): string {
        return `${this.base()}assignment_group/edit_security_settings?course_id=${this.course.id}&assignment_group_id=${group.id}`;
    }

    forkGroupUrl(group: AssignmentGroup): string {
        return `${this.base()}assignment_group/forking_menu?course_id=${this.course.id}&assignment_group_id=${group.id}`;
    }

    /*
     * Server-backed actions
     */
    private post(url: string, payload: any, onSuccess: (data: any) => void) {
        showOverlay();
        ajax_post(url, payload).then((data: any) => {
            if (data.success) {
                onSuccess(data);
            } else {
                alert("ERROR: " + data.message);
                console.error(data.message);
            }
        }).catch((error: any) => {
            alert("ERROR: " + (error.statusText || error));
            console.error(error);
        }).always(hideOverlay);
    }

    private findGroup(groupId: number): AssignmentGroup | null {
        return this.groups().find((group) => group.id === groupId) || null;
    }

    addAssignment() {
        this.post("assignments/new", {
            name: this.createAssignmentName(),
            url: this.createAssignmentUrl(),
            course_id: this.course.id,
            level: this.createAssignmentLevel(),
            type: this.createAssignmentType().toLowerCase(),
            group: this.createAssignmentGroupId()
        }, (data: any) => {
            $("#assignment-create").modal("hide");
            const assignment = this.server.assignmentStore.newInstance(data.assignment);
            assignment.group(this.findGroup(data.group));
            this.assignments.push(assignment);
        });
    }

    addGroup() {
        this.post("assignment_group/add", {
            course_id: this.course.id,
            name: this.createGroupName(),
            url: this.createGroupUrl()
        }, (data: any) => {
            $("#group-create").modal("hide");
            const group = this.server.assignmentGroupStore.newInstance(data.assignment_group);
            this.groups.push(group);
            this.createAssignmentGroupId(group.id);
        });
    }

    moveMembership(assignment: Assignment, newGroup: AssignmentGroup | null) {
        const oldGroup = assignment.group();
        const oldGroupId = oldGroup != null ? oldGroup.id : -1;
        const newGroupId = newGroup != null ? newGroup.id : -1;
        if (oldGroupId === newGroupId) {
            return;
        }
        this.post("assignment_group/move_membership", {
            assignment_id: assignment.id,
            old_group_id: oldGroupId,
            new_group_id: newGroupId
        }, () => {
            assignment.group(newGroup);
        });
    }

    renameGroup(group: AssignmentGroup) {
        const newName = window.prompt("Give a new name for this group:", group.name());
        if (newName == null) {
            return;
        }
        const newUrl = window.prompt("Give a new url for this group:", group.url());
        this.post("assignment_group/edit", {
            assignment_group_id: group.id,
            new_name: newName,
            new_url: newUrl != null ? newUrl : group.url()
        }, (data: any) => {
            group.name(data.name);
            group.url(data.url);
        });
    }

    removeGroup(group: AssignmentGroup) {
        if (!confirm("Are you really sure you want to delete this group? Its assignments will become ungrouped.")) {
            return;
        }
        this.post("assignment_group/remove", {
            assignment_group_id: group.id
        }, () => {
            this.assignments().forEach((assignment) => {
                if (assignment.group() != null && assignment.group().id === group.id) {
                    assignment.group(null);
                }
            });
            this.groups.remove(group);
        });
    }

    removeAssignment(assignment: Assignment) {
        if (!confirm("Are you really sure you want to delete this assignment?")) {
            return;
        }
        this.post("assignments/remove", {
            assignment_id: assignment.id
        }, () => {
            this.assignments.remove(assignment);
        });
    }

    forkAssignment(assignment: Assignment, askUrl: boolean) {
        const payload: any = {
            assignment_id: assignment.id,
            course_id: this.course.id,
            group: assignment.group() != null ? assignment.group().id : -1
        };
        if (askUrl) {
            const newUrl = prompt("What would you like the URL to be?", assignment.url() || "");
            if (newUrl == null) {
                return;
            }
            payload.url = newUrl;
        }
        this.post("assignments/fork", payload, (data: any) => {
            const forked = this.server.assignmentStore.newInstance(data.assignment);
            forked.group(this.findGroup(data.group));
            this.assignments.push(forked);
        });
    }
}

ko.components.register("assignment-manager", {
    viewModel: AssignmentManager,
    template: ASSIGNMENT_MANAGER_MODALS_HTML + ASSIGNMENT_MANAGER_HTML
});
