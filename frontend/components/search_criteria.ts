/**
 * The criteria-search building blocks shared by View Submissions and the
 * Course Analytics dashboard: the searchable field specs (grouped into the
 * Submission / Metrics / Student / Assignment namespaces that the server's
 * `controllers/submission_search.py` registry defines), the operator sets,
 * and the SearchCriterion row model that the criteria editors bind to.
 *
 * Each page opts into the field groups its endpoint accepts: View Submissions
 * takes Submission + Student + Assignment; Analytics adds Metrics (its detail
 * endpoint evaluates criteria against each submission's pivoted counters).
 * Evaluation happens server-side, where the full code/feedback contents live.
 */
import * as ko from 'knockout';

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

/** A namespace of fields, rendered as one optgroup in the field dropdown. */
export interface SearchFieldGroup {
    label: string;
    fields: SearchFieldSpec[];
}

export const NUMBER_OPERATORS: SearchOperator[] = [
    {key: "ge", label: "is at least"},
    {key: "gt", label: "is more than"},
    {key: "eq", label: "is exactly"},
    {key: "ne", label: "is not"},
    {key: "le", label: "is at most"},
    {key: "lt", label: "is less than"}
];
export const TEXT_OPERATORS: SearchOperator[] = [
    {key: "contains", label: "contains"},
    {key: "icontains", label: "contains (ignore case)"},
    {key: "regex", label: "matches regex"}
];
export const DATE_OPERATORS: SearchOperator[] = [
    {key: "before", label: "is before"},
    {key: "on", label: "is on"},
    {key: "after", label: "is after"}
];
export const IS_OPERATOR: SearchOperator[] = [{key: "is", label: "is"}];

const TRUE_FALSE = [
    {value: "true", label: "Yes"},
    {value: "false", label: "No"}
];

/** Submission columns: exactly the original View Submissions field set. */
export const SUBMISSION_SEARCH_FIELDS: SearchFieldSpec[] = [
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

/** Student fields, compared against the submission's user. */
export const STUDENT_SEARCH_FIELDS: SearchFieldSpec[] = [
    {key: "user.name", label: "Student name", type: "text", operators: TEXT_OPERATORS,
     placeholder: "e.g. Ada"},
    {key: "user.email", label: "Student email", type: "text", operators: TEXT_OPERATORS,
     placeholder: "e.g. @udel.edu"}
];

/** Assignment fields, compared against the submission's assignment. */
export const ASSIGNMENT_SEARCH_FIELDS: SearchFieldSpec[] = [
    {key: "assignment.name", label: "Assignment name", type: "text", operators: TEXT_OPERATORS,
     placeholder: "e.g. Maze"},
    {key: "assignment.url", label: "Assignment URL", type: "text", operators: TEXT_OPERATORS,
     placeholder: "e.g. bakery_intro"},
    {key: "assignment.type", label: "Assignment type", type: "select", operators: IS_OPERATOR,
     options: [{value: "blockpy", label: "BlockPy"},
               {value: "python", label: "Python"},
               {value: "java", label: "Java"},
               {value: "typescript", label: "TypeScript"},
               {value: "maze", label: "Maze"},
               {value: "reading", label: "Reading"},
               {value: "quiz", label: "Quiz"},
               {value: "textbook", label: "Textbook"},
               {value: "explanation", label: "Explanation"},
               {value: "explain", label: "Explain"},
               {value: "feedback", label: "Feedback"}]},
    {key: "assignment.group", label: "Assignment group name", type: "text",
     operators: TEXT_OPERATORS, placeholder: "e.g. Day 12",
     help: "Matched against the name of the group the submission was made through."},
    {key: "assignment.reviewed", label: "Assignment needs manual review", type: "select",
     operators: IS_OPERATOR, options: TRUE_FALSE},
    {key: "assignment.hidden", label: "Assignment is hidden", type: "select",
     operators: IS_OPERATOR, options: TRUE_FALSE}
];

const NO_DATA_HELP = "Submissions with no recorded data for a metric never match " +
                     "(no data is not the same as 0).";

/** Metric fields, compared against each submission's pivoted counters.
 * Only accepted by the analytics detail endpoint. */
export const METRIC_SEARCH_FIELDS: SearchFieldSpec[] = [
    {key: "total_time_spent", label: "Time on task (seconds)", type: "number",
     operators: NUMBER_OPERATORS, placeholder: "e.g. 3600",
     help: "A floor estimate of engaged time, in seconds. " + NO_DATA_HELP},
    {key: "total_edits", label: "Edit events", type: "number",
     operators: NUMBER_OPERATORS, placeholder: "e.g. 50"},
    {key: "total_interventions", label: "Runs with feedback", type: "number",
     operators: NUMBER_OPERATORS, placeholder: "e.g. 10"},
    {key: "feedback_total", label: "Feedback events", type: "number",
     operators: NUMBER_OPERATORS, placeholder: "e.g. 10"},
    {key: "feedback_syntax_errors", label: "Syntax errors", type: "number",
     operators: NUMBER_OPERATORS, placeholder: "e.g. 5"},
    {key: "feedback_runtime_errors", label: "Runtime errors", type: "number",
     operators: NUMBER_OPERATORS, placeholder: "e.g. 5"},
    {key: "feedback_assertion_counts", label: "Assertions run", type: "number",
     operators: NUMBER_OPERATORS, placeholder: "e.g. 20"},
    {key: "feedback_assertion_successes", label: "Assertions passed", type: "number",
     operators: NUMBER_OPERATORS, placeholder: "e.g. 20"},
    {key: "syntax_error_rate", label: "Syntax error rate (0-1)", type: "number",
     operators: NUMBER_OPERATORS, placeholder: "e.g. 0.5",
     help: "Runs ending in a syntax error, as a fraction of all feedback runs. " + NO_DATA_HELP},
    {key: "runtime_error_rate", label: "Runtime error rate (0-1)", type: "number",
     operators: NUMBER_OPERATORS, placeholder: "e.g. 0.5",
     help: "Runs ending in a runtime error, as a fraction of all feedback runs. " + NO_DATA_HELP},
    {key: "assertion_success_rate", label: "Assertion success rate (0-1)", type: "number",
     operators: NUMBER_OPERATORS, placeholder: "e.g. 0.8",
     help: "Instructor-test assertions passed, as a fraction of assertions run. " + NO_DATA_HELP},
    {key: "total_read_time", label: "Read time (milliseconds)", type: "number",
     operators: NUMBER_OPERATORS, placeholder: "e.g. 60000"},
    {key: "total_active_read_time", label: "Active read time (milliseconds)", type: "number",
     operators: NUMBER_OPERATORS, placeholder: "e.g. 60000",
     help: "Reading time during which the mouse was moving."},
    {key: "total_watch_time", label: "Video watch time (milliseconds)", type: "number",
     operators: NUMBER_OPERATORS, placeholder: "e.g. 60000"},
    {key: "pastes", label: "Paste events", type: "number",
     operators: NUMBER_OPERATORS, placeholder: "e.g. 3"},
    {key: "window_visibility_changes", label: "Tab switches", type: "number",
     operators: NUMBER_OPERATORS, placeholder: "e.g. 10"},
    {key: "emojis", label: "Emoji seen in code", type: "number",
     operators: NUMBER_OPERATORS, placeholder: "e.g. 1",
     help: "Accumulated across edits (the same emoji is re-counted on later edits), " +
           "so treat as 'some vs. lots' rather than an exact count."}
];

export const VIEW_SUBMISSIONS_FIELD_GROUPS: SearchFieldGroup[] = [
    {label: "Submission", fields: SUBMISSION_SEARCH_FIELDS},
    {label: "Student", fields: STUDENT_SEARCH_FIELDS},
    {label: "Assignment", fields: ASSIGNMENT_SEARCH_FIELDS}
];

export const ANALYTICS_FIELD_GROUPS: SearchFieldGroup[] = [
    {label: "Submission", fields: SUBMISSION_SEARCH_FIELDS},
    {label: "Metrics", fields: METRIC_SEARCH_FIELDS},
    {label: "Student", fields: STUDENT_SEARCH_FIELDS},
    {label: "Assignment", fields: ASSIGNMENT_SEARCH_FIELDS}
];

export function flattenFieldGroups(groups: SearchFieldGroup[]): SearchFieldSpec[] {
    return groups.reduce((flat: SearchFieldSpec[], group) => flat.concat(group.fields), []);
}

// Labels complete the sentence "Match ___ of the following conditions"
export const SEARCH_COMBINATORS = [
    {key: "and", label: "all"},
    {key: "or", label: "any"},
    {key: "none", label: "none"},
    {key: "xor", label: "exactly one"}
];

/** One editable condition row: (field, operator, value, negate?). */
export class SearchCriterion {
    field: KnockoutObservable<string>;
    operator: KnockoutObservable<string>;
    value: KnockoutObservable<string>;
    negate: KnockoutObservable<boolean>;
    spec: KnockoutReadonlyComputed<SearchFieldSpec>;

    constructor(private fields: SearchFieldSpec[]) {
        this.field = ko.observable(fields[0].key);
        this.operator = ko.observable(fields[0].operators[0].key);
        this.value = ko.observable("");
        this.negate = ko.observable(false);
        this.spec = ko.pureComputed(() =>
            this.fields.find((fieldSpec) => fieldSpec.key === this.field()) || this.fields[0]);
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
