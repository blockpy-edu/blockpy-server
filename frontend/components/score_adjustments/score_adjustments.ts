/**
 * Score Adjustments is the bulk review editor: it corrects many students'
 * scores on one assignment at once, across every course the grader teaches
 * that uses the assignment.
 *
 * The page reads top to bottom as four steps:
 *
 *  1. Who: for a quiz, pick a question and tick the answers to include; for a
 *     coding problem with seeded pools, tick the variations. Extra conditions
 *     (score, times graded, ...) reuse the criteria rows from View Submissions.
 *  2. What: give or remove credit for the question (worked out per student on
 *     the server), or a fixed amount, or a target total; and the comment that
 *     students will see.
 *  3. Preview: who matches and what would happen to each, with a checkbox per
 *     student. Nothing is written until Apply.
 *  4. Adjustments already made on this assignment, each of which can be sent
 *     to the LMS, edited, or removed.
 *
 * A batch is one parent review that every student's review inherits from, so
 * the comment is edited in one place for all courses. Everything is decided on
 * the server (`controllers/endpoints/score_adjustments.py`); this component
 * only describes the rule and shows the result. The comment is student-facing
 * and, like any review comment, is trusted to the grader who writes it; the
 * question and answer behind an adjustment belong in the private note.
 */
import * as ko from 'knockout';
import {ajax_post} from "../../services/ajax";
import {prettyPrintDateTime} from "../../utilities/dates";
import {SearchCriterion, SEARCH_COMBINATORS, ADJUSTMENT_FIELD_GROUPS,
        flattenFieldGroups} from "../search_criteria";

import SCORE_ADJUSTMENTS_HTML from "./score_adjustments.html";

export interface ScoreAdjustmentsConfig {
    courseId: number;
    assignmentId: number;
    questionId?: string;
    defaultComment: string;
    viewSubmissionsUrl: string;
}

interface CourseChoice {
    id: number;
    name: string;
    submissions: number;
    checked: KnockoutObservable<boolean>;
}

interface QuestionPart {
    key: string;
    label: string;
}

interface QuestionChoice {
    id: string;
    position: number;
    label: string;
    type: string;
    points: number;
    graded: boolean;
    parts: QuestionPart[];
}

/** One row of the answer table (or of the variation list). */
interface TallyRow {
    key: string | number;
    label: string;
    count: number;
    credit: string;
    checked: KnockoutObservable<boolean>;
}

interface PreviewRow {
    submission_id: number;
    student: string;
    email: string;
    course: string;
    answer: string;
    variation: string;
    now: number;
    delta: number;
    after: number;
    notes: string[];
    /** Whether the server suggests ticking this row. */
    include: boolean;
    checked: KnockoutObservable<boolean>;
}

/** A sortable column of the preview table. */
interface PreviewColumn {
    key: string;
    label: string;
    numeric: boolean;
    value: (row: PreviewRow) => string | number;
}

const PREVIEW_COLUMNS: PreviewColumn[] = [
    {key: "student", label: "Student", numeric: false, value: (row) => row.student},
    {key: "course", label: "Course", numeric: false, value: (row) => row.course},
    {key: "now", label: "Now", numeric: true, value: (row) => row.now},
    {key: "delta", label: "Adjustment", numeric: true, value: (row) => row.delta},
    // Matches what the cell shows: a row that is left out keeps its current score
    {key: "after", label: "After", numeric: true, value: (row) => row.checked.peek() ? row.after : row.now},
    {key: "notes", label: "Notes", numeric: false, value: (row) => row.notes.join(" · ")}
];

export interface BatchSummary {
    id: number;
    comment: string;
    note: string;
    rule: string;
    fixed_amount: number | null;
    students: number;
    amount_low: number | null;
    amount_high: number | null;
    customized: number;
    pending: number;
    unlinked: number;
    sent: number;
    pending_submission_ids: number[];
    courses: {id: number, name: string}[];
    editable: boolean;
    author: string;
    date_created: string;
    assignment_changed: boolean;
}

interface BatchStudent {
    review_id: number;
    submission_id: number;
    student: string;
    course: string;
    amount: number;
    total: number;
    customized: boolean;
    own_comment: string;
    lms: string;
}

const CREDIT_LABELS: Record<string, string> = {
    full: "Full credit", none: "No credit", partial: "Partial credit", mixed: "Mixed",
    ungraded: "Not graded", "not counted": "Not counted"
};
const CREDIT_CLASSES: Record<string, string> = {
    full: "badge-success", none: "badge-danger", partial: "badge-warning", mixed: "badge-warning",
    ungraded: "badge-light", "not counted": "badge-light"
};

/** "+8", "-5", "0": an amount the way a review shows it. */
export function signed(amount: number): string {
    const rounded = Math.round(amount * 10) / 10;
    return (rounded > 0 ? "+" : "") + rounded;
}

export function percent(amount: number): string {
    return (Math.round(amount * 10) / 10) + "%";
}

export class ScoreAdjustments {
    config: ScoreAdjustmentsConfig;

    // Loading the assignment
    isLoading: KnockoutObservable<boolean>;
    loadError: KnockoutObservable<string>;
    kind: KnockoutObservable<string>;
    isHidden: KnockoutObservable<boolean>;
    isSurvey: KnockoutObservable<boolean>;

    // Step 1: who
    courses: KnockoutObservableArray<CourseChoice>;
    questions: KnockoutObservableArray<QuestionChoice>;
    questionId: KnockoutObservable<string>;
    part: KnockoutObservable<string>;
    tallyRows: KnockoutObservableArray<TallyRow>;
    tallySubmissions: KnockoutObservable<number>;
    isTallying: KnockoutObservable<boolean>;
    searchFieldGroups = ADJUSTMENT_FIELD_GROUPS;
    searchFields = flattenFieldGroups(ADJUSTMENT_FIELD_GROUPS);
    combinatorOptions = SEARCH_COMBINATORS;
    searchCombinator: KnockoutObservable<string>;
    searchCriteria: KnockoutObservableArray<SearchCriterion>;

    // Step 2: what
    mode: KnockoutObservable<string>;
    amountValue: KnockoutObservable<string>;
    amountUnit: KnockoutObservable<string>;
    comment: KnockoutObservable<string>;
    note: KnockoutObservable<string>;

    // Step 3: preview
    previewRows: KnockoutObservableArray<PreviewRow>;
    hasPreview: KnockoutObservable<boolean>;
    isPreviewing: KnockoutObservable<boolean>;
    isApplying: KnockoutObservable<boolean>;
    previewError: KnockoutObservable<string>;
    searchErrors: KnockoutObservableArray<string>;
    ruleDescription: KnockoutObservable<string>;
    applyMessage: KnockoutObservable<string>;
    /** Key of the column the preview is sorted by; "" keeps the server's order (course, then student). */
    previewSortKey: KnockoutObservable<string>;
    previewSortDescending: KnockoutObservable<boolean>;

    // Step 4: existing batches
    batches: KnockoutObservableArray<BatchSummary>;
    batchMessage: KnockoutObservable<string>;
    batchError: KnockoutObservable<string>;
    openBatchId: KnockoutObservable<number>;
    openBatchStudents: KnockoutObservableArray<BatchStudent>;
    editingBatchId: KnockoutObservable<number>;
    editComment: KnockoutObservable<string>;
    editNote: KnockoutObservable<string>;
    editAmount: KnockoutObservable<string>;
    editIncludeCustomized: KnockoutObservable<boolean>;
    editError: KnockoutObservable<string>;
    removingBatchId: KnockoutObservable<number>;
    publishOnSend: KnockoutObservable<boolean>;
    sendingBatchId: KnockoutObservable<number>;
    sendProgress: KnockoutObservable<string>;
    sendFailures: KnockoutObservableArray<string>;

    selectedCourseIds: KnockoutReadonlyComputed<number[]>;
    currentQuestion: KnockoutReadonlyComputed<QuestionChoice | null>;
    isQuiz: KnockoutReadonlyComputed<boolean>;
    hasTarget: KnockoutReadonlyComputed<boolean>;
    selectedKeys: KnockoutReadonlyComputed<(string | number)[]>;
    selectedCount: KnockoutReadonlyComputed<number>;
    checkedPreviewRows: KnockoutReadonlyComputed<PreviewRow[]>;
    selectablePreviewRows: KnockoutReadonlyComputed<PreviewRow[]>;
    sortedPreviewRows: KnockoutReadonlyComputed<PreviewRow[]>;
    previewColumns: KnockoutReadonlyComputed<PreviewColumn[]>;
    allPreviewChecked: ko.PureComputed<boolean>;
    previewIsSuggested: KnockoutReadonlyComputed<boolean>;
    previewSummary: KnockoutReadonlyComputed<string>;
    canApply: KnockoutReadonlyComputed<boolean>;
    whoSummary: KnockoutReadonlyComputed<string>;
    canPreview: KnockoutReadonlyComputed<boolean>;
    needsValue: KnockoutReadonlyComputed<boolean>;

    private tallyRequest = 0;

    constructor(params: {config: ScoreAdjustmentsConfig}) {
        this.config = params.config;

        this.isLoading = ko.observable(true);
        this.loadError = ko.observable("");
        this.kind = ko.observable("quiz");
        this.isHidden = ko.observable(false);
        this.isSurvey = ko.observable(false);

        this.courses = ko.observableArray<CourseChoice>([]);
        this.questions = ko.observableArray<QuestionChoice>([]);
        this.questionId = ko.observable("");
        this.part = ko.observable("");
        this.tallyRows = ko.observableArray<TallyRow>([]);
        this.tallySubmissions = ko.observable(0);
        this.isTallying = ko.observable(false);
        this.searchCombinator = ko.observable("and");
        this.searchCriteria = ko.observableArray<SearchCriterion>([]);

        this.mode = ko.observable("fixed");
        this.amountValue = ko.observable("");
        this.amountUnit = ko.observable("percent");
        this.comment = ko.observable(this.config.defaultComment);
        this.note = ko.observable("");

        this.previewRows = ko.observableArray<PreviewRow>([]);
        this.hasPreview = ko.observable(false);
        this.isPreviewing = ko.observable(false);
        this.isApplying = ko.observable(false);
        this.previewError = ko.observable("");
        this.searchErrors = ko.observableArray<string>([]);
        this.ruleDescription = ko.observable("");
        this.applyMessage = ko.observable("");
        this.previewSortKey = ko.observable("");
        this.previewSortDescending = ko.observable(false);

        this.batches = ko.observableArray<BatchSummary>([]);
        this.batchMessage = ko.observable("");
        this.batchError = ko.observable("");
        this.openBatchId = ko.observable<number>(null);
        this.openBatchStudents = ko.observableArray<BatchStudent>([]);
        this.editingBatchId = ko.observable<number>(null);
        this.editComment = ko.observable("");
        this.editNote = ko.observable("");
        this.editAmount = ko.observable("");
        this.editIncludeCustomized = ko.observable(false);
        this.editError = ko.observable("");
        this.removingBatchId = ko.observable<number>(null);
        this.publishOnSend = ko.observable(false);
        this.sendingBatchId = ko.observable<number>(null);
        this.sendProgress = ko.observable("");
        this.sendFailures = ko.observableArray<string>([]);

        this.selectedCourseIds = ko.pureComputed(() => this.readSelectedCourseIds());
        this.isQuiz = ko.pureComputed(() => this.kind() === "quiz");
        this.currentQuestion = ko.pureComputed(() => this.findQuestion(this.questionId()));
        // Whether students are being chosen by an answer table or variation list at all
        this.hasTarget = ko.pureComputed(() => this.tallyRows().length > 0);
        this.selectedKeys = ko.pureComputed(() =>
            this.tallyRows().filter((row) => row.checked()).map((row) => row.key));
        this.selectedCount = ko.pureComputed(() =>
            this.tallyRows().filter((row) => row.checked()).reduce((total, row) => total + row.count, 0));
        this.checkedPreviewRows = ko.pureComputed(() =>
            this.previewRows().filter((row) => row.checked()));
        // A row that would not change has nothing to apply, so it cannot be ticked
        this.selectablePreviewRows = ko.pureComputed(() =>
            this.previewRows().filter((row) => row.delta !== 0));
        this.allPreviewChecked = ko.pureComputed({
            read: () => {
                const selectable = this.selectablePreviewRows();
                return selectable.length > 0 && selectable.every((row) => row.checked());
            },
            write: (checked: boolean) => this.setAllPreview(checked)
        });
        this.previewIsSuggested = ko.pureComputed(() =>
            this.previewRows().every((row) => row.checked() === row.include));
        this.previewColumns = ko.pureComputed(() =>
            PREVIEW_COLUMNS.filter((column) => column.key !== "course" || this.courses().length > 1));
        this.sortedPreviewRows = ko.pureComputed(() => {
            const rows = this.previewRows();
            const column = PREVIEW_COLUMNS.filter((candidate) => candidate.key === this.previewSortKey())[0];
            if (column == null) {
                return rows;
            }
            const direction = this.previewSortDescending() ? -1 : 1;
            // The sort is stable, so ties stay in the server's course-then-student order
            return rows.slice().sort((left, right) => {
                const a = column.value(left);
                const b = column.value(right);
                const order = typeof a === "number" && typeof b === "number"
                    ? a - b
                    : String(a).localeCompare(String(b), undefined, {sensitivity: "base", numeric: true});
                return direction * order;
            });
        });
        this.canApply = ko.pureComputed(() =>
            this.checkedPreviewRows().length > 0 && !this.isApplying());
        this.needsValue = ko.pureComputed(() => this.mode() !== "credit" && this.mode() !== "remove");

        this.whoSummary = ko.pureComputed(() => {
            const courseCount = this.selectedCourseIds().length;
            const where = courseCount === 1 ? "1 course" : `${courseCount} courses`;
            if (this.isQuiz() && this.currentQuestion() != null) {
                return this.selectedKeys().length
                    ? `${this.selectedCount()} of ${this.tallySubmissions()} submissions in ${where} gave a selected answer`
                    : `Tick the answers to include (${this.tallySubmissions()} submissions in ${where})`;
            }
            if (!this.isQuiz() && this.hasTarget() && this.selectedKeys().length) {
                return `${this.selectedCount()} of ${this.tallySubmissions()} submissions in ${where} got a selected variation`;
            }
            return `All ${this.tallySubmissions()} submissions in ${where}, narrowed by the conditions below`;
        });

        this.canPreview = ko.pureComputed(() => {
            if (!this.selectedCourseIds().length || this.isPreviewing() || this.isApplying()) {
                return false;
            }
            if (this.isQuiz() && this.currentQuestion() != null && !this.selectedKeys().length) {
                return false;
            }
            return !this.needsValue() || String(this.amountValue()).trim() !== "";
        });

        this.previewSummary = ko.pureComputed(() => {
            const rows = this.previewRows();
            const changing = this.checkedPreviewRows().length;
            return `${rows.length} match${rows.length === 1 ? "es" : ""} · ${changing} will change · ` +
                   `${rows.length - changing} left out`;
        });

        // Changing who or what makes an old preview wrong, so drop it
        const invalidate = () => this.clearPreview();
        this.mode.subscribe(invalidate);
        this.amountValue.subscribe(invalidate);
        this.amountUnit.subscribe(invalidate);
        this.searchCombinator.subscribe(invalidate);
        this.searchCriteria.subscribe(invalidate);
        this.questionId.subscribe((questionId: string) => {
            // A manual subscription runs before the computeds that depend on the same
            // observable are refreshed, so look the question up from the new value
            const question = this.findQuestion(questionId);
            const isQuestionMode = this.mode() === "credit" || this.mode() === "remove";
            this.part("");
            // Credit modes only make sense with a graded question to credit
            if ((question == null || !question.graded) && isQuestionMode) {
                this.mode("fixed");
            } else if (question != null && question.graded
                       && this.mode() === "fixed" && String(this.amountValue()).trim() === "") {
                this.mode("credit");
            }
            this.loadTally();
        });
        this.part.subscribe(() => this.loadTally());

        this.load();
    }

    private post(path: string, payload: any): JQuery.jqXHR<any> {
        return ajax_post(`grading/adjustments/${path}`, {payload: JSON.stringify(payload)});
    }

    /* Plain reads of the observables, safe to call from inside a subscription
     * (where a computed over the same observable may not have been refreshed yet). */

    private readSelectedCourseIds(): number[] {
        return this.courses().filter((course) => course.checked()).map((course) => course.id);
    }

    private findQuestion(questionId: string): QuestionChoice | null {
        return this.questions().find((question) => question.id === questionId) || null;
    }

    private scope(): any {
        return {assignment_id: this.config.assignmentId, course_ids: this.readSelectedCourseIds()};
    }

    /*
     * Loading
     */

    load() {
        this.isLoading(true);
        this.post("load", {assignment_id: this.config.assignmentId}).then((data: any) => {
            this.isLoading(false);
            if (!data.success) {
                this.loadError(data.message || "This assignment could not be loaded.");
                return;
            }
            this.kind(data.kind);
            this.isHidden(data.assignment.hidden);
            this.isSurvey(data.is_survey);
            this.courses(data.courses.map((course: any) => {
                // Start with the course the page was opened from; the others are one click away
                const checked = ko.observable(course.id === this.config.courseId || data.courses.length === 1);
                checked.subscribe(() => { this.loadTally(); });
                return {id: course.id, name: course.name, submissions: course.submissions, checked};
            }));
            if (!this.readSelectedCourseIds().length && this.courses().length) {
                this.courses()[0].checked(true);
            }
            this.questions(data.questions);
            this.batches(data.batches);
            const wanted = this.config.questionId;
            if (wanted && data.questions.some((question: QuestionChoice) => question.id === wanted)) {
                // The subscription loads the tally for it
                this.questionId(wanted);
            } else {
                this.loadTally();
            }
        }).fail(() => {
            this.isLoading(false);
            this.loadError("This assignment could not be loaded. Check your connection and reload the page.");
        });
    }

    selectAllCourses() {
        this.courses().forEach((course) => course.checked(true));
    }

    /** Refresh the answer table (or the variation list) for the current question and courses. */
    loadTally() {
        this.clearPreview();
        if (!this.readSelectedCourseIds().length) {
            this.tallyRows([]);
            this.tallySubmissions(0);
            return;
        }
        const request = ++this.tallyRequest;
        this.isTallying(true);
        this.post("tally", {...this.scope(), question_id: this.questionId(), part: this.part()})
            .then((data: any) => {
                if (request !== this.tallyRequest) {
                    return;  // A newer request is on its way
                }
                this.isTallying(false);
                if (!data.success) {
                    this.tallyRows([]);
                    return;
                }
                this.tallySubmissions(data.submissions);
                this.tallyRows(data.rows.map((row: any) => {
                    const checked = ko.observable(false);
                    checked.subscribe(() => this.clearPreview());
                    return {...row, checked};
                }));
            }).fail(() => {
                if (request === this.tallyRequest) {
                    this.isTallying(false);
                }
            });
    }

    creditLabel(row: TallyRow): string {
        return CREDIT_LABELS[row.credit] || "";
    }

    creditClass(row: TallyRow): string {
        return CREDIT_CLASSES[row.credit] || "badge-light";
    }

    /*
     * Conditions
     */

    addSearchCriterion() {
        const criterion = new SearchCriterion(this.searchFields);
        const invalidate = () => this.clearPreview();
        criterion.field.subscribe(invalidate);
        criterion.operator.subscribe(invalidate);
        criterion.value.subscribe(invalidate);
        criterion.negate.subscribe(invalidate);
        this.searchCriteria.push(criterion);
    }

    removeSearchCriterion(criterion: SearchCriterion) {
        this.searchCriteria.remove(criterion);
    }

    /*
     * The rule and amount as the server expects them
     */

    private rule(): any {
        const rule: any = {};
        if (this.isQuiz() && this.currentQuestion() != null) {
            rule.question_id = this.questionId();
            rule.part = this.part() || null;
            rule.answers = this.selectedKeys();
        } else if (!this.isQuiz()) {
            rule.variations = this.selectedKeys();
        }
        if (this.searchCriteria().length) {
            rule.search = {
                combinator: this.searchCombinator(),
                criteria: this.searchCriteria().map((criterion) => criterion.toJson())
            };
        }
        return rule;
    }

    private amount(): any {
        return {mode: this.mode(), value: this.amountValue(), unit: this.amountUnit()};
    }

    private request(): any {
        return {...this.scope(), rule: this.rule(), amount: this.amount(), comment: this.comment()};
    }

    /*
     * Preview and apply
     */

    clearPreview() {
        if (this.hasPreview()) {
            this.hasPreview(false);
            this.previewRows([]);
        }
        this.previewError("");
    }

    preview() {
        this.isPreviewing(true);
        this.previewError("");
        this.applyMessage("");
        this.post("preview", this.request()).then((data: any) => {
            this.isPreviewing(false);
            if (!data.success) {
                this.previewError(data.message || "The preview failed.");
                return;
            }
            this.searchErrors(data.search_errors || []);
            this.ruleDescription(data.rule_description || "");
            this.previewRows(data.rows.map((row: any) => ({...row, checked: ko.observable(row.include)})));
            this.hasPreview(true);
        }).fail(() => {
            this.isPreviewing(false);
            this.previewError("The preview failed. Check your connection and try again.");
        });
    }

    setAllPreview(checked: boolean) {
        this.selectablePreviewRows().forEach((row) => row.checked(checked));
    }

    selectAllPreview() {
        this.setAllPreview(true);
    }

    selectNonePreview() {
        this.setAllPreview(false);
    }

    /** Back to the rows the preview ticked by itself. */
    resetPreviewSelection() {
        this.previewRows().forEach((row) => row.checked(row.include));
    }

    /** First click sorts ascending, a second click on the same column flips it. */
    sortPreviewBy(key: string) {
        if (this.previewSortKey() === key) {
            this.previewSortDescending(!this.previewSortDescending());
        } else {
            this.previewSortDescending(false);
            this.previewSortKey(key);
        }
    }

    previewSortState(key: string): string {
        if (this.previewSortKey() !== key) {
            return "none";
        }
        return this.previewSortDescending() ? "descending" : "ascending";
    }

    previewSortArrow(key: string): string {
        const state = this.previewSortState(key);
        return state === "none" ? "↕" : state === "ascending" ? "▲" : "▼";
    }

    apply() {
        const chosen = this.checkedPreviewRows().map((row) => row.submission_id);
        if (!chosen.length) {
            return;
        }
        this.isApplying(true);
        this.previewError("");
        this.post("apply", {...this.request(), note: this.note(), submission_ids: chosen}).then((data: any) => {
            this.isApplying(false);
            if (!data.success) {
                this.previewError(data.message || "The adjustment could not be saved.");
                return;
            }
            this.batches(data.batches);
            this.clearPreview();
            this.note("");
            this.tallyRows().forEach((row) => row.checked(false));
            this.applyMessage(`Added a review to ${data.applied} submission${data.applied === 1 ? "" : "s"}. ` +
                              "Their grades have not been sent to the LMS yet: use Send grades below.");
        }).fail(() => {
            this.isApplying(false);
            this.previewError("The adjustment could not be saved. Check your connection and try again.");
        });
    }

    signed(amount: number): string {
        return signed(amount);
    }

    percent(amount: number): string {
        return percent(amount);
    }

    deltaClass(amount: number): string {
        return amount > 0 ? "text-success" : amount < 0 ? "text-danger" : "text-muted";
    }

    /*
     * Existing batches
     */

    batchAmount(batch: BatchSummary): string {
        if (batch.amount_low == null) {
            return "";
        }
        if (batch.amount_low === batch.amount_high) {
            return signed(batch.amount_low);
        }
        return `${signed(batch.amount_low)} to ${signed(batch.amount_high)}`;
    }

    batchCourses(batch: BatchSummary): string {
        return batch.courses.map((course) => course.name || "another course").join(", ");
    }

    batchDate(batch: BatchSummary): string {
        return batch.date_created ? prettyPrintDateTime(batch.date_created) : "";
    }

    toggleStudents(batch: BatchSummary) {
        if (this.openBatchId() === batch.id) {
            this.openBatchId(null);
            return;
        }
        this.openBatchStudents([]);
        this.openBatchId(batch.id);
        this.post("batch", {batch_id: batch.id}).then((data: any) => {
            if (data.success && this.openBatchId() === batch.id) {
                this.openBatchStudents(data.rows);
            } else if (!data.success) {
                this.batchError(data.message || "The students could not be loaded.");
                this.openBatchId(null);
            }
        });
    }

    viewSubmissionUrl(student: BatchStudent): string {
        return `${window["$URL_ROOT"]}grading/review_editor?submission_id=${student.submission_id}`;
    }

    lmsLabel(state: string): string {
        return state === "sent" ? "Sent" : state === "pending" ? "Not sent" : "No LMS link";
    }

    lmsClass(state: string): string {
        return state === "sent" ? "badge-success" : state === "pending" ? "badge-warning" : "badge-light";
    }

    startEdit(batch: BatchSummary) {
        this.editComment(batch.comment);
        this.editNote(batch.note);
        this.editAmount("");
        this.editIncludeCustomized(false);
        this.editError("");
        this.removingBatchId(null);
        this.editingBatchId(batch.id);
    }

    cancelEdit() {
        this.editingBatchId(null);
    }

    saveEdit(batch: BatchSummary) {
        this.editError("");
        this.post("batch/edit", {
            batch_id: batch.id, comment: this.editComment(), note: this.editNote(),
            amount: String(this.editAmount()).trim(), include_customized: this.editIncludeCustomized()
        }).then((data: any) => {
            if (!data.success) {
                this.editError(data.message || "The change could not be saved.");
                return;
            }
            this.batches(data.batches);
            this.editingBatchId(null);
            this.openBatchId(null);
            this.batchMessage(data.changed
                ? `Saved. ${data.changed} review${data.changed === 1 ? "" : "s"} changed amount; send grades again.`
                : "Saved.");
        }).fail(() => this.editError("The change could not be saved. Check your connection and try again."));
    }

    askRemove(batch: BatchSummary) {
        this.editingBatchId(null);
        this.removingBatchId(batch.id);
    }

    cancelRemove() {
        this.removingBatchId(null);
    }

    remove(batch: BatchSummary) {
        this.batchError("");
        this.post("batch/remove", {batch_id: batch.id}).then((data: any) => {
            this.removingBatchId(null);
            if (!data.success) {
                this.batchError(data.message || "The adjustment could not be removed.");
                return;
            }
            this.batches(data.batches);
            this.openBatchId(null);
            this.batchMessage(`Removed the adjustment from ${data.removed} submission${data.removed === 1 ? "" : "s"}. ` +
                              "Grades already sent to the LMS still include it until they are sent again.");
            this.loadTally();
        }).fail(() => this.batchError("The adjustment could not be removed. Check your connection and try again."));
    }

    /** Send each unsent grade in turn, so every request is short and every result is shown. */
    sendGrades(batch: BatchSummary) {
        const ids = batch.pending_submission_ids.slice();
        if (!ids.length || this.sendingBatchId() != null) {
            return;
        }
        this.sendingBatchId(batch.id);
        this.sendFailures([]);
        this.batchMessage("");
        let sent = 0;
        const total = ids.length;
        const next = () => {
            if (!ids.length) {
                this.sendingBatchId(null);
                this.sendProgress("");
                const failed = this.sendFailures().length;
                this.batchMessage(`Sent ${sent} of ${total} grade${total === 1 ? "" : "s"}` +
                                  (failed ? `; ${failed} failed and can be sent again.` : "."));
                this.refreshBatches();
                return;
            }
            const submissionId = ids.shift();
            this.sendProgress(`Sending grades… ${total - ids.length} of ${total}`);
            this.post("send", {submission_id: submissionId, publish: this.publishOnSend()}).then((data: any) => {
                if (data.success && data.status === "sent") {
                    sent += 1;
                } else {
                    this.sendFailures.push(`Submission ${submissionId}: ${data.message || "not sent"}`);
                }
            }).fail(() => {
                this.sendFailures.push(`Submission ${submissionId}: the request failed`);
            }).always(next);
        };
        next();
    }

    refreshBatches() {
        this.post("load", {assignment_id: this.config.assignmentId}).then((data: any) => {
            if (data.success) {
                this.batches(data.batches);
            }
        });
    }
}

ko.components.register("score-adjustments", {
    viewModel: ScoreAdjustments,
    template: SCORE_ADJUSTMENTS_HTML
});
