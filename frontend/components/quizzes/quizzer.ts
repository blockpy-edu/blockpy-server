import {Server} from "../../services/server";
import {User} from "../../models/user";
import * as ko from 'knockout';
import {AssignmentInterface, AssignmentInterfaceJson, EditorMode} from "../assignment_interface";

import {Quiz, QuizMode} from './quiz';
import {Question, subscribeToStudent} from './questions';
import "./quizzer_question_status";
import {QUIZZER_HTML} from './quiz_ui';

// Maybe TODO: Add bookmarking
    // Add a question mark button that let's them flag this to return to later
// TODO: Attempt cooldowns
// TODO: Allow bulk regrading of students' feedbacks/scoring
// TODO: Check for orphaned feedbacks and answers
// TODO: Click to edit component in modal
// TODO: One question at a time
// TODO: "Validate" mode that shows off whether quiz is valid (questions/feedback work)

// TODO: Click to edit the markdown of a question

// Done:
// Show as [instructor|student] mode
// Hide feedback/score mode
// Allow instructors to see currently failed to grade assignments


export interface QuizzerJson {
    server: Server;
    courseId: number;
    user: User;
    currentAssignmentId: ko.Observable<number>;
    assignmentGroupId: number;
}


export type QuizEditorMode = EditorMode | "QUIZ_EDITOR";

export class Quizzer extends AssignmentInterface {
    quiz: ko.Observable<Quiz>;

    forceQuiz: ko.Observable<boolean>;
    currentQuestion: ko.Observable<Question>;
    isReadOnly: ko.PureComputed<boolean>;

    editorMode: ko.Observable<QuizEditorMode>;
    asStudent: ko.Observable<boolean>;
    isDirty: ko.Observable<boolean>;

    errorMessage: ko.Observable<string>;

    subscriptions: {
        quiz: ko.Subscription
        currentAssignmentId: ko.Subscription
        questions: ko.Subscription[]
    }

    visibleQuestions: ko.PureComputed<Question[]>;


    constructor(params: AssignmentInterfaceJson) {
        super(params);
        this.subscriptions = {quiz: null, currentAssignmentId: null, questions: null};

        this.quiz = ko.observable(null);

        // UI state
        this.isDirty = ko.observable(false);
        this.asStudent = ko.observable(!this.isInstructor());
        this.editorMode = ko.observable(EditorMode.SUBMISSION);
        this.errorMessage = ko.observable("");

        this.subscriptions.currentAssignmentId = this.currentAssignmentId.subscribe((newId) => {
            this.loadQuiz(newId);
        }, this);
        this.loadQuiz(this.currentAssignmentId());

        this.subscriptions.questions = [] as ko.Subscription[];
        this.subscriptions.quiz = this.quiz.subscribe((quiz) => {
            this.quiz().questions().map((question: Question) => {
                subscribeToStudent(question).map((subscribable) => {
                    let subscription = subscribable.subscribe((value: any) => {
                        this.onChange();
                    });
                    this.subscriptions.questions.push(subscription);
                })
            });
            this.quiz().hidePools();
        });

        // this.visibleQuestions = ko.pureComputed<Question[]>( () => {
        //     const isNotStudent = !this.asStudent();
        //     return this.quiz()?.questions().filter(q => isNotStudent || q.visible());
        // }, this);

        this.isReadOnly = ko.pureComputed<boolean>(() => {
            return !this.quiz().attempting();
        }, this);
    }

    dispose() {
        super.dispose();
        this.subscriptions.currentAssignmentId.dispose();
        this.subscriptions.quiz.dispose();
        this.subscriptions.questions.map((question: ko.Subscription) => question.dispose());
    }

    lookupReading(readingUrl: string): Promise<number> {
        return this.server.assignmentStore.getIdByUrl(readingUrl);
    }

    loadQuiz(assignmentId: number) {
        if (assignmentId != null) {
            let BlockPyServer = window['$MAIN_BLOCKPY_EDITOR'].components.server;
            let data = BlockPyServer.createServerData();
            data["assignment_id"] = assignmentId;
            BlockPyServer._postBlocking("loadAssignment", data, 4,
                (response: any) => {
                    if (response.success) {
                        let assignment = this.server.assignmentStore.newInstance(response.assignment);
                        let submission = response.submission ? this.server.submissionStore.newInstance(response.submission) : null;
                        this.assignment(assignment);
                        this.submission(submission);
                        //console.log(submission, submission.code);
                        this.quiz(new Quiz(assignment, submission, this.lookupReading.bind(this)));
                        this.markClean();
                        console.log(this.quiz())
                    } else {
                        console.error("Failed to load", response);
                        this.assignment(null);
                        this.errorMessage(response.message.message);
                    }
                },
                (e: any, textStatus: string, errorThrown: any) => {
                    console.error("Failed to load (HTTP LEVEL)", e, textStatus, errorThrown);
                    this.assignment(null);
                });
        } else {
            this.assignment(null);
        }
    }

    onChange() {
        if (this.quiz().attemptStatus() === QuizMode.ATTEMPTING) {
            this.markDirty();
            this.saveFile("answer.py", this.quiz().submissionAsJson(), false, this.markClean.bind(this));
        }
    }

    saveSubmission() {
        this.markDirty();
        this.saveFile("answer.py", this.quiz().submissionAsJson(), true, this.markClean.bind(this));
    }

    saveSubmissionRaw() {
        this.markDirty();
        this.saveFile("answer.py", this.submission().code(), true, this.markClean.bind(this));
    }

    clearSubmission() {
        this.markDirty();
        this.saveFile("answer.py", "", true, this.markClean.bind(this));
        this.submission().code("");
    }

    markDirty() {
        this.isDirty(true);
    }

    markClean() {
        this.isDirty(false);
    }

    changeEditing(question: Question, persist: boolean) {
        if (question.editing() && persist) {
            let changed = this.quiz().editAssignmentBody(this.assignment(), question, question.rawBody());
            if (changed) {
                this.saveAssignment();
            }
        }
        question.editing(!question.editing());
    }

    startQuiz() {
        this.errorMessage("");
        this.quiz().attemptCount(this.quiz().attemptCount()+1);
        this.quiz().attempting(true);
        this.quiz().clearFeedback();
        this.quiz().hidePools();
        //this.quiz().clearAnswers();
        this.saveSubmission();
        this.submission().code(this.quiz().submissionAsJson());
    }

    saveAssignment() {
        this.quiz().loadAssignment(this.assignment(), this.submission());
        this.saveFile("!instructions.md", this.assignment().instructions(), true, this.markClean.bind(this));
        this.saveFile("!on_run.py", this.assignment().onRun(), true, this.markClean.bind(this));
        this.saveAssignmentSettings({
            settings: this.assignment().settings(),
            points: this.assignment().points(),
            url: this.assignment().url(),
            name: this.assignment().name()
        });
    }

    submit() {
        let BlockPyServer = window['$MAIN_BLOCKPY_EDITOR'].components.server;
        let now = new Date();
        let data = {
            assignment_id: this.assignment().id,
            assignment_group_id: this.assignmentGroupId,
            course_id: this.courseId,
            submission_id: this.submission().id,
            user_id: this.user.id,
            status: 0,
            correct: false,
            timestamp: now.getTime(),
            timezone: now.getTimezoneOffset(),
            passcode: window['$MAIN_BLOCKPY_EDITOR'].model.display.passcode(),
        };
        // TODO: Skipping questions doesn't skip giving you points does it??
        BlockPyServer._postBlocking("updateSubmission", data, 3,
               (response: any) => {
                    //console.log(response.message.feedbacks);
                    if (response.success || response.message.message === "Generic LTI Failure - perhaps not logged into LTI session?") {
                        console.log(response);
                        this.quiz().includeFeedbacks(response.feedbacks || response.message.feedbacks);
                    }
                    if (!response.success) {
                        console.error(response);
                        this.errorMessage(response.message.message);
                    }
                    this.submission().submissionStatus(response.submission_status);
                    this.quiz().attempting(false);
                    if (response.correct) {
                        this.markCorrect(this.assignment().id);
                    }
               },
               (e: any, textStatus: string, errorThrown: any) => {
                    console.error("Failed to load (HTTP LEVEL)", e, textStatus, errorThrown);
                    this.errorMessage("HTTP ERROR (try reloading the page; if still an error, report to instructor!): "+ textStatus+"\n"+errorThrown);
                });
    }
}

ko.components.register("quizzer", {
    viewModel: Quizzer,
    template: QUIZZER_HTML
});
