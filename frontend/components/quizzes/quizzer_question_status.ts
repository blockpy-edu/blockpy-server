import * as ko from 'knockout';
import {Question, subscribeToStudent} from "./questions";
import {Quiz, QuizFeedbackType} from "./quiz";

export const QUIZZER_QUESTION_STATUS_HTML = `
<!--<a data-bind="attr: { href: '#quizzer-question-anchor-'+indexId() }">-->
    <!-- ko if: isAnchor -->
        <span data-bind="attr: {id: 'quizzer-question-anchor-'+indexId(),
                                title: 'Question '+indexId()}"></span>
    <!-- /ko -->
    <span data-bind="switch: statusCode, attr: {title: 'Question '+indexId()},
                     visible: question.type !== 'text_only_question'">
        <!-- ko case: 'unanswered' -->
            <i class="far fa-square text-secondary" style="background-color: white"></i>
        <!-- /ko -->
        <!-- ko case: 'answered' -->
            <i class="fas fa-square text-secondary"></i>
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
    question: Question;
    quiz: ko.Observable<Quiz>;
    isAnchor: boolean;
    indexId: number
}

export class QuizzerQuestionStatus {
    private status: ko.Observable<string>[];
    private asStudent: ko.Observable<boolean>;
    private quiz: ko.Observable<Quiz>;
    private question: Question;
    private isAnchor: boolean;
    private indexId: number;
    private statusCode: ko.PureComputed<string>;
    constructor(params: QuizzerQuestionStatusJson) {
        this.status = params.status;
        this.quiz = params.quiz;
        this.asStudent = params.asStudent;
        this.question = params.question;
        this.isAnchor = params.isAnchor;
        this.indexId = params.indexId;
        this.statusCode = ko.pureComputed<string>(() => {
            const value = this.question && subscribeToStudent(this.question);
            //console.log(this.question.id, value && value.map((answer) => answer()));
            const answered = value && value.filter((answer: ko.Observable<string>) =>
                Array.isArray(answer()) ? answer().length : answer()).length;
            const graded = this.question && this.question.feedback();
            const errored = graded && this.question.feedback().status === "error";
            const correct = graded && this.question.feedback().correct;
            if (graded && (!this.asStudent() || this.quiz().feedbackType() === QuizFeedbackType.IMMEDIATE)) {
                if (errored) {
                    return 'error';
                } else if (correct) {
                    return 'correct';
                } else {
                    return 'incorrect';
                }
            } else {
                if (answered) {
                    return 'answered';
                } else {
                    return 'unanswered';
                }
            }
        }, this);
    }
}

ko.components.register("quizzer-question-status", {
    viewModel: QuizzerQuestionStatus,
    template: QUIZZER_QUESTION_STATUS_HTML
});
