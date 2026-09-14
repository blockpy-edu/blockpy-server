/**
 * The audit review pages: one Knockout component that renders the dashboard,
 * the global feed, a course's history, a user's history, an assignment's
 * history and the server errors page, depending on `config.page`. The page
 * tells the component which filters are fixed; everything reads through the
 * JSON endpoints in controllers/endpoints/audit.py, which enforce access
 * server-side regardless of what this component asks for.
 */
import * as ko from 'knockout';
import {ajax_get} from "../../services/ajax";
import {prettyPrintDateTime} from "../../utilities/dates";

import AUDIT_HTML from "./audit.html";

export type AuditPage = 'dashboard' | 'feed' | 'course' | 'user' | 'assignment' | 'errors';

export interface AuditConfig {
    page: AuditPage;
    isAdmin: boolean;
    title: string;
    courseId?: number;
    userId?: number;
    assignmentId?: number;
    header?: any;
}

export interface AuditUser {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
}

/** One row of the normalized feed (see encode_events on the server). */
export interface AuditEvent {
    table: string;
    id: number;
    when: string;
    event_type: string;
    subject: AuditUser | null;
    subject_id: number;
    authorizer: AuditUser | null;
    authorizer_id: number | null;
    course: {id: number, name: string, url: string} | null;
    course_id: number;
    assignment: {id: number, name: string, url: string, type: string} | null;
    assignment_id: number | null;
    assignment_version?: number;
    role_id: number | null;
    field: string | null;
    value: string | null;
    value_truncated: boolean;
}

export interface DiffLine {
    kind: 'add' | 'remove' | 'context' | 'header';
    text: string;
}

const DESTRUCTIVE = new Set(['delete', 'removed', 'unadopt', 'unfork']);
const CREATIVE = new Set(['create', 'given', 'adopt', 'fork']);
const TABLE_LABELS: Record<string, string> = {
    course_log: "Course", role_log: "Roster", assignment_log: "Assignment"
};

function base(): string {
    return window["$URL_ROOT"] || "/";
}

function userName(user: AuditUser | null, fallbackId: number | null): string {
    if (!user) {
        return fallbackId === null || fallbackId === undefined ? "?" : `user ${fallbackId}`;
    }
    const name = `${user.first_name || ""} ${user.last_name || ""}`.trim();
    return name || user.email || `user ${user.id}`;
}

/** Local-time day label used to group a feed by day. */
function dayOf(when: string): string {
    const date = new Date(when);
    if (isNaN(date.getTime())) {
        return when.slice(0, 10);
    }
    return date.toLocaleDateString(undefined, {year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'});
}

/** "2026-09-13T14:02" from a datetime-local input to the ISO the server parses. */
function localInputToIso(value: string): string {
    if (!value) {
        return "";
    }
    const date = new Date(value);
    return isNaN(date.getTime()) ? "" : date.toISOString();
}

/** A polyline for an inline SVG sparkline over daily counts. */
export function sparklinePoints(counts: number[], width: number = 120, height: number = 28): string {
    if (!counts.length) {
        return "";
    }
    const max = Math.max(1, ...counts);
    const step = counts.length > 1 ? width / (counts.length - 1) : 0;
    return counts.map((count, index) => {
        const x = counts.length > 1 ? index * step : width / 2;
        const y = height - 2 - (count / max) * (height - 4);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
}

/** One rendered event, with its lazily loaded full value and diff. */
export class EventRow {
    event: AuditEvent;
    expanded: ko.Observable<boolean>;
    fullValue: ko.Observable<string | null>;
    diffOpen: ko.Observable<boolean>;
    diffLines: ko.ObservableArray<DiffLine>;
    diffPreviousId: ko.Observable<number | null>;
    diffLoading: ko.Observable<boolean>;
    diffError: ko.Observable<string>;

    constructor(event: AuditEvent) {
        this.event = event;
        this.expanded = ko.observable(false);
        this.fullValue = ko.observable(null);
        this.diffOpen = ko.observable(false);
        this.diffLines = ko.observableArray([]);
        this.diffPreviousId = ko.observable(null);
        this.diffLoading = ko.observable(false);
        this.diffError = ko.observable("");
    }

    key(): string {
        return `${this.event.table}:${this.event.id}`;
    }

    shownValue(): string {
        const full = this.fullValue();
        return full !== null ? full : (this.event.value || "");
    }

    /** Show the whole value, fetching it once if the feed truncated it. */
    toggleValue() {
        if (this.expanded()) {
            this.expanded(false);
            return;
        }
        this.expanded(true);
        if (this.event.value_truncated && this.fullValue() === null) {
            ajax_get(`audit/event/${this.event.table}/${this.event.id}`, {})
                .then((data: any) => {
                    if (data.success) {
                        this.fullValue(data.event.value);
                    }
                });
        }
    }

    canDiff(): boolean {
        return this.event.table === 'assignment_log' && this.event.event_type === 'edit'
            && this.event.field !== null;
    }

    toggleDiff() {
        if (this.diffOpen()) {
            this.diffOpen(false);
            return;
        }
        this.diffOpen(true);
        if (this.diffLines().length || this.diffLoading()) {
            return;
        }
        this.diffLoading(true);
        ajax_get(`audit/diff/${this.event.table}/${this.event.id}`, {})
            .then((data: any) => {
                if (data.success) {
                    this.diffPreviousId(data.previous_id);
                    this.diffLines(data.lines);
                } else {
                    this.diffError(data.message || "Could not load the diff.");
                }
            })
            .catch(() => this.diffError("Could not load the diff."))
            .always(() => this.diffLoading(false));
    }
}

export interface DayGroup {
    day: string;
    rows: EventRow[];
}

/** One filtered, pageable feed. Fixed filters come from the page and cannot be changed
 * by the user; the server re-applies them anyway. */
export class Feed {
    fixed: Record<string, string>;
    tables: ko.ObservableArray<string>;
    eventTypes: ko.Observable<string>;
    subjectId: ko.Observable<string>;
    search: ko.Observable<string>;
    since: ko.Observable<string>;
    before: ko.Observable<string>;
    rows: ko.ObservableArray<EventRow>;
    loading: ko.Observable<boolean>;
    error: ko.Observable<string>;
    exhausted: ko.Observable<boolean>;
    hasLoaded: ko.Observable<boolean>;
    groups: ko.PureComputed<DayGroup[]>;
    pageSize: number;

    constructor(fixed: Record<string, string>, pageSize: number = 50) {
        this.fixed = fixed;
        this.pageSize = pageSize;
        this.tables = ko.observableArray(['course_log', 'role_log', 'assignment_log']);
        this.eventTypes = ko.observable("");
        this.subjectId = ko.observable("");
        this.search = ko.observable("");
        this.since = ko.observable("");
        this.before = ko.observable("");
        this.rows = ko.observableArray([]);
        this.loading = ko.observable(false);
        this.error = ko.observable("");
        this.exhausted = ko.observable(false);
        this.hasLoaded = ko.observable(false);
        this.groups = ko.pureComputed(() => {
            const groups: DayGroup[] = [];
            this.rows().forEach((row) => {
                const day = dayOf(row.event.when);
                const last = groups[groups.length - 1];
                if (last && last.day === day) {
                    last.rows.push(row);
                } else {
                    groups.push({day, rows: [row]});
                }
            });
            return groups;
        });
    }

    params(beforeIso?: string): Record<string, string> {
        const params: Record<string, string> = {
            limit: String(this.pageSize),
            ...this.fixed
        };
        if (!('tables' in this.fixed)) {
            params.tables = this.tables().join(",");
        }
        if (this.eventTypes().trim()) {
            params.event_types = this.eventTypes().trim();
        }
        if (this.subjectId().trim()) {
            params.subject_id = this.subjectId().trim();
        }
        if (this.search().trim()) {
            params.search = this.search().trim();
        }
        const since = localInputToIso(this.since());
        if (since) {
            params.since = since;
        }
        const before = beforeIso || localInputToIso(this.before());
        if (before) {
            params.before = before;
        }
        return params;
    }

    reload() {
        this.rows([]);
        this.exhausted(false);
        this.fetch();
    }

    loadMore() {
        const rows = this.rows();
        if (!rows.length) {
            return this.fetch();
        }
        this.fetch(rows[rows.length - 1].event.when);
    }

    private fetch(beforeIso?: string) {
        if (this.loading()) {
            return;
        }
        this.loading(true);
        this.error("");
        ajax_get('audit/feed', this.params(beforeIso))
            .then((data: any) => {
                if (!data.success) {
                    this.error(data.message || "Could not load the audit feed.");
                    return;
                }
                const seen = new Set(this.rows().map((row) => row.key()));
                const fresh = (data.events as AuditEvent[])
                    .map((event) => new EventRow(event))
                    .filter((row) => !seen.has(row.key()));
                this.rows.push(...fresh);
                if (data.events.length < this.pageSize || !fresh.length) {
                    this.exhausted(true);
                }
            })
            .catch((response: any) => {
                const message = response && response.responseJSON && response.responseJSON.message;
                this.error(message || "Could not load the audit feed.");
            })
            .always(() => {
                this.loading(false);
                this.hasLoaded(true);
            });
    }
}

export interface ErrorGroup {
    error_type: string;
    frame: string;
    count: number;
    first_seen: string;
    last_seen: string;
    day: number;
    week: number;
    days: number[];
    occurrences: any[];
}

export class AuditReview {
    config: AuditConfig;
    page: AuditPage;
    isAdmin: boolean;
    header: any;

    feed: Feed;
    // The user page's second column: role changes the user received
    receivedFeed: Feed | null;
    // Course page tabs
    tab: ko.Observable<string>;

    // Dashboard
    summary: ko.Observable<any>;
    summaryError: ko.Observable<string>;
    destructive: ko.ObservableArray<EventRow>;
    privilege: ko.ObservableArray<EventRow>;
    lookupQuery: ko.Observable<string>;
    lookupMatches: ko.ObservableArray<any>;
    lookupSearched: ko.Observable<boolean>;

    // Errors page
    errorGroups: ko.ObservableArray<ErrorGroup>;
    errorTotal: ko.Observable<number>;
    errorDays: ko.Observable<number>;
    errorsLoading: ko.Observable<boolean>;
    errorsError: ko.Observable<string>;
    expandedGroup: ko.Observable<ErrorGroup | null>;
    expandedOccurrence: ko.Observable<any>;

    tableLabels = TABLE_LABELS;

    constructor(params: {config: AuditConfig}) {
        this.config = params.config;
        this.page = this.config.page;
        this.isAdmin = !!this.config.isAdmin;
        this.header = this.config.header || {};
        this.tab = ko.observable('all');
        this.receivedFeed = null;

        const fixed: Record<string, string> = {};
        if (this.page === 'course') {
            fixed.course_id = String(this.config.courseId);
        } else if (this.page === 'assignment') {
            fixed.assignment_id = String(this.config.assignmentId);
            fixed.tables = 'assignment_log';
        } else if (this.page === 'user') {
            fixed.actor_id = String(this.config.userId);
            this.receivedFeed = new Feed({tables: 'role_log', subject_id: String(this.config.userId)});
        }
        this.feed = new Feed(fixed);

        this.summary = ko.observable(null);
        this.summaryError = ko.observable("");
        this.destructive = ko.observableArray([]);
        this.privilege = ko.observableArray([]);
        this.lookupQuery = ko.observable("");
        this.lookupMatches = ko.observableArray([]);
        this.lookupSearched = ko.observable(false);

        this.errorGroups = ko.observableArray([]);
        this.errorTotal = ko.observable(0);
        this.errorDays = ko.observable(30);
        this.errorsLoading = ko.observable(false);
        this.errorsError = ko.observable("");
        this.expandedGroup = ko.observable(null);
        this.expandedOccurrence = ko.observable(null);

        this.tab.subscribe((tab) => {
            const tables = {all: ['course_log', 'role_log', 'assignment_log'], settings: ['course_log'],
                            roster: ['role_log'], assignments: ['assignment_log']}[tab];
            this.feed.tables(tables);
            this.feed.reload();
        });

        if (this.page === 'dashboard') {
            this.loadSummary();
        } else if (this.page === 'errors') {
            this.loadErrors();
        } else {
            this.feed.reload();
            if (this.receivedFeed) {
                this.receivedFeed.reload();
            }
        }
    }

    // ------------------------------------------------------------------
    // Links

    base(): string {
        return base();
    }

    dashboardUrl(): string {
        return `${base()}audit/`;
    }

    feedUrl(): string {
        return `${base()}audit/events`;
    }

    errorsUrl(): string {
        return `${base()}audit/errors`;
    }

    courseUrl(courseId: number): string {
        return `${base()}audit/course/${courseId}`;
    }

    userUrl(userId: number): string {
        return `${base()}audit/user/${userId}`;
    }

    assignmentUrl(assignmentId: number): string {
        return `${base()}audit/assignment/${assignmentId}`;
    }

    // ------------------------------------------------------------------
    // Row rendering

    when(event: AuditEvent): string {
        return prettyPrintDateTime(event.when);
    }

    badgeClass(event: AuditEvent): string {
        if (DESTRUCTIVE.has(event.event_type)) {
            return "badge-danger";
        }
        if (CREATIVE.has(event.event_type)) {
            return "badge-success";
        }
        if (event.event_type === 'corrupted') {
            return "badge-warning";
        }
        return "badge-secondary";
    }

    tableLabel(event: AuditEvent): string {
        return TABLE_LABELS[event.table] || event.table;
    }

    subjectName(event: AuditEvent): string {
        return userName(event.subject, event.subject_id);
    }

    authorizerName(event: AuditEvent): string {
        return userName(event.authorizer, event.authorizer_id);
    }

    /** Roster rows read as sentences: "Ada gave Lulu learner". */
    sentence(event: AuditEvent): string {
        const subject = this.subjectName(event);
        const authorizer = this.authorizerName(event);
        const self = event.authorizer_id === event.subject_id;
        switch (event.event_type) {
            case 'given':
                return self ? `${subject} joined as ${event.value}` : `${authorizer} gave ${subject} ${event.value}`;
            case 'removed':
                return self ? `${subject} left (was ${event.value})` : `${authorizer} removed ${subject} (was ${event.value})`;
            case 'changed':
                return self ? `${subject} became ${event.value}` : `${authorizer} changed ${subject} to ${event.value}`;
            default:
                return `${authorizer} ${event.event_type} ${subject} ${event.value}`;
        }
    }

    targetLabel(event: AuditEvent): string {
        if (event.table === 'assignment_log') {
            return event.assignment ? event.assignment.name : `assignment ${event.assignment_id} (deleted)`;
        }
        return event.course ? event.course.name : `course ${event.course_id} (deleted)`;
    }

    /** Where the target link goes: only when the target still exists. */
    targetUrl(event: AuditEvent): string | null {
        if (event.table === 'assignment_log') {
            return event.assignment ? this.assignmentUrl(event.assignment_id) : null;
        }
        return event.course ? this.courseUrl(event.course_id) : null;
    }

    /** The course an assignment edit was made from, shown on assignment pages. */
    contextLabel(event: AuditEvent): string {
        if (event.table !== 'assignment_log') {
            return "";
        }
        return event.course ? `from ${event.course.name}` : `from course ${event.course_id}`;
    }

    fieldLabel(event: AuditEvent): string {
        if (event.table === 'role_log') {
            return "";
        }
        if (event.field === 'assignment_id' || event.field === 'assignment_group_id' || event.field === 'forked_id') {
            return event.field.replace(/_/g, " ");
        }
        return event.field || "";
    }

    // ------------------------------------------------------------------
    // Dashboard

    loadSummary() {
        ajax_get('audit/summary', {})
            .then((data: any) => {
                if (!data.success) {
                    this.summaryError(data.message || "Could not load the summary.");
                    return;
                }
                this.summary(data);
                this.destructive(data.destructive.map((event: AuditEvent) => new EventRow(event)));
                this.privilege(data.privilege.map((event: AuditEvent) => new EventRow(event)));
            })
            .catch(() => this.summaryError("Could not load the summary."));
    }

    tileTables(): string[] {
        return ['course_log', 'role_log', 'assignment_log'];
    }

    tileFor(table: string): any {
        const summary = this.summary();
        return summary ? summary.tables[table] : null;
    }

    sparkline(days: {count: number}[]): string {
        return sparklinePoints(days.map((day) => day.count));
    }

    sparklineCounts(counts: number[]): string {
        return sparklinePoints(counts);
    }

    lookup() {
        const query = this.lookupQuery().trim();
        this.lookupSearched(true);
        if (!query) {
            this.lookupMatches([]);
            return;
        }
        ajax_get('audit/lookup', {q: query})
            .then((data: any) => {
                this.lookupMatches(data.success ? data.matches : []);
            });
    }

    // ------------------------------------------------------------------
    // Errors page

    loadErrors() {
        this.errorsLoading(true);
        this.errorsError("");
        ajax_get('audit/error_groups', {days: this.errorDays()})
            .then((data: any) => {
                if (!data.success) {
                    this.errorsError(data.message || "Could not load the errors.");
                    return;
                }
                this.errorGroups(data.groups);
                this.errorTotal(data.total);
            })
            .catch(() => this.errorsError("Could not load the errors."))
            .always(() => this.errorsLoading(false));
    }

    toggleGroup(group: ErrorGroup) {
        this.expandedOccurrence(null);
        this.expandedGroup(this.expandedGroup() === group ? null : group);
    }

    toggleOccurrence(occurrence: any) {
        this.expandedOccurrence(this.expandedOccurrence() === occurrence ? null : occurrence);
    }

    occurrenceUser(occurrence: any): string {
        return userName(occurrence.user, null);
    }

    whenString(when: string): string {
        return when ? prettyPrintDateTime(when) : "";
    }
}

ko.components.register("audit-review", {
    viewModel: AuditReview,
    template: AUDIT_HTML
});
