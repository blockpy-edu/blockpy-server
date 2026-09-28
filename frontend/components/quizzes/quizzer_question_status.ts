import * as ko from 'knockout';
import {Question, subscribeToStudent} from "./questions";
import {Quiz, QuizFeedbackType} from "./quiz";

export const QUIZZER_QUESTION_STATUS_HTML = `
<!--<a data-bind="attr: { href: '#quizzer-question-anchor-'+indexId() }">-->
    <!-- ko if: isAnchor -->
        <span data-bind="attr: {id: 'quizzer-question-anchor-'+question.id,
                                title: label}"></span>
    <!-- /ko -->
    <span data-bind="switch: statusCode, attr: {title: label},
                     visible: questions().some(q => q.type !== 'text_only_question')">
        <!-- ko case: 'unanswered' -->
            <i class="far fa-square text-secondary" style="background-color: white"></i>
        <!-- /ko -->
        <!-- ko case: 'answered' -->
            <i class="fas fa-square text-secondary"></i>
        <!-- /ko -->
        <!-- ko case: 'partial' -->
            <i class="fas fa-minus-square text-secondary"></i>
        <!-- /ko -->
        <!-- ko case: 'error' -->
            <i class="fas fa-square text-info"></i>
        <!-- /ko -->
        <!-- ko case: 'correct' -->
            <i class="fas fa-square text-success"></i>
        <!-- /ko -->
        <!-- ko case: 'incorrect' -->
            <i class="fas fa-square text-danger"></i>
        <!-- /ko -->
    </span>
<!--</a>-->
`;

export interface QuizzerQuestionStatusJson {
    status: ko.Observable<string>[];
    asStudent: ko.Observable<boolean>;
    /** The question to report on; or pass `questions` for an aggregated Question Group status */
    question?: Question;
    questions?: Question[];
    quiz: ko.Observable<Quiz>;
    isAnchor: boolean;
    /** Human-readable name shown as the tooltip, e.g. "Question 3" or "Question Group 4" */
    label: string
}

/** Status of one question: unanswered | answered | error | correct | incorrect */
function questionStatus(question: Question, showGraded: boolean): string {
    const value = subscribeToStudent(question);
    const answered = value.filter((answer: ko.Observable<string>) =>
        Array.isArray(answer()) ? answer().length : answer()).length;
    const graded = question.feedback();
    if (graded && showGraded) {
        if (graded.status === "error") {
            return 'error';
        } else if (graded.correct) {
            return 'correct';
        } else {
            return 'incorrect';
        }
    }
    return answered ? 'answered' : 'unanswered';
}

/**
 * Collapse several statuses into one: graded states win (error > incorrect > correct),
 * otherwise answered/unanswered, with 'partial' when only some questions are answered.
 */
function aggregateStatus(statuses: string[]): string {
    if (statuses.length === 0) {
        return 'unanswered';
    }
    if (statuses.includes('error')) {
        return 'error';
    }
    if (statuses.includes('incorrect')) {
        return 'incorrect';
    }
    if (statuses.every((status) => status === 'correct')) {
        return 'correct';
    }
    if (statuses.every((status) => status === 'answered' || status === 'correct')) {
        return 'answered';
    }
    if (statuses.every((status) => status === 'unanswered')) {
        return 'unanswered';
    }
    return 'partial';
}

export class QuizzerQuestionStatus {
    private status: ko.Observable<string>[];
    private asStudent: ko.Observable<boolean>;
    private quiz: ko.Observable<Quiz>;
    private question: Question;
    /** Accessor, because Knockout hands component params that depend on observables over as computeds */
    private questions: () => Question[];
    private isAnchor: boolean;
    private label: string;
    private statusCode: ko.PureComputed<string>;
    constructor(params: QuizzerQuestionStatusJson) {
        this.status = params.status;
        this.quiz = params.quiz;
        this.asStudent = params.asStudent;
        this.questions = () => {
            const many = ko.unwrap(params.questions);
            if (Array.isArray(many)) {
                return many;
            }
            const one = ko.unwrap(params.question);
            return one ? [one] : [];
        };
        this.question = this.questions()[0];
        this.isAnchor = params.isAnchor;
        this.label = params.label;
        this.statusCode = ko.pureComputed<string>(() => {
            const showGraded = !this.asStudent() || this.quiz().feedbackType() === QuizFeedbackType.IMMEDIATE;
            return aggregateStatus(this.questions().map((question) => questionStatus(question, showGraded)));
        }, this);
    }
}

ko.components.register("quizzer-question-status", {
    viewModel: QuizzerQuestionStatus,
    template: QUIZZER_QUESTION_STATUS_HTML
});
