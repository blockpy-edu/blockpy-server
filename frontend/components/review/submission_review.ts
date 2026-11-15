/**
 * The main review panel for one submission: the status controls, the score
 * summary, and the general feedback list. It owns the list of reviews that the
 * per-line buttons (line_review.ts) also read and add to.
 */
import {GradingStatus, Submission, SubmissionStatus} from "../../models/submission";
import {Review} from "../../models/review";
import {User} from "../../models/user";
import {Assignment} from "../../models/assignment";
import * as ko from 'knockout';
import {hideOverlay, showOverlay} from "../../services/ajax";
import {Server} from "../../services/server";
import {ReviewModelState, Tag, parseReviewInheritance} from "./types";
import {SingleReviewInterface} from "./single_review";
import {closeSubmissionStatus, colorSubmissionStatus, explainGradingStatus,
        colorGradingStatus, labelGradingStatus} from "./status_labels";

export interface SubmissionReviewInterfaceJson {
    server: Server;
    // This is the (initially empty) list of SingleReviewInterfaces wrapping Review objects
    reviewInterfaces: KnockoutObservableArray<SingleReviewInterface>;
    reviews: Review[];
    // All others are simply data
    submission: Submission;
    assignment: Assignment;
    author: User;
    genericReviews: Review[];
    tags: Tag[];
    isGrader: KnockoutObservable<boolean>;
    previewStudentMode: KnockoutObservable<boolean>;
    isLtiActive: boolean;
    hasAutoFeedback: KnockoutReadonlyComputed<boolean>;
    canSeeFeedback: KnockoutReadonlyComputed<boolean>;
    canEditFeedback: KnockoutReadonlyComputed<boolean>;
    mainReviewInterface: KnockoutObservable<SubmissionReviewInterface>;
}

const DEFAULT_MARKS = [
    "Passed human review",
    "Caught Cheating"
];

// Main container of data about this submission and its reviews
export class SubmissionReviewInterface {
    server: Server;
    // The submission being reviewed
    submission: Submission;
    author: User;
    assignment: Assignment;
    // Reviews used in just this submission
    reviews: KnockoutObservableArray<SingleReviewInterface>;
    // Read-only Reviews available from the global site context
    genericReviews: Review[];
    // Read-only Tags available from the global assignment context
    tags: Tag[];

    // UI
    isGrader: KnockoutObservable<boolean>;
    isLtiActive: KnockoutObservable<boolean>;
    previewStudentMode: KnockoutObservable<boolean>;

    mainReviewInterface: KnockoutObservable<SubmissionReviewInterface>;

    // Fast-lookups of the read-only Generic Reviews and Tags
    readonly lookupGenericReviews: Record<number, Review>;
    readonly lookupTags: Record<number, Tag>;

    private canSeeFeedback: KnockoutReadonlyComputed<boolean>;
    private canEditFeedback: KnockoutReadonlyComputed<boolean>;
    private canMarkCorrect: KnockoutReadonlyComputed<boolean>;
    private canMarkCheating: KnockoutReadonlyComputed<boolean>;
    private totalScore: KnockoutReadonlyComputed<number>;
    private releaseFeedbackExplanation: KnockoutReadonlyComputed<string>;
    private releaseFeedbackColor: KnockoutReadonlyComputed<string>;
    private releaseFeedbackLabel: KnockoutReadonlyComputed<string>;
    private closeSubmissionExplanation: KnockoutReadonlyComputed<string>;
    private closeSubmissionColor: KnockoutReadonlyComputed<string>;
    private closeSubmissionLabel: KnockoutReadonlyComputed<string>;
    private hasAutoFeedback: KnockoutReadonlyComputed<boolean>;

    // Views onto the master list of `reviews`, categorizing their types
    private generalReviews: KnockoutReadonlyComputed<SingleReviewInterface[]>;
    private lineReviews: KnockoutReadonlyComputed<SingleReviewInterface[]>;
    
    constructor(params: SubmissionReviewInterfaceJson) {
        this.mainReviewInterface = params.mainReviewInterface;
        this.server = params.server;
        this.mainReviewInterface(this);
        // Readonly data setup
        this.submission = params.submission;
        this.author = params.author;
        this.assignment = params.assignment;
        this.lookupGenericReviews = {};
        this.lookupTags = {};
        this.tags = params.tags.map(
            (tag: Tag) => {
                this.lookupTags[tag.id] = tag;
                return tag;
            }
        );
        this.hasAutoFeedback = ko.pureComputed<boolean>(() => {
            let settingsRaw = this.assignment.settings();
            let settings = JSON.parse(settingsRaw || "{}");
            return settings.disableFeedback || false;
        });
        this.genericReviews = params.genericReviews.map(
            (review: Review) => {
                this.lookupGenericReviews[review.id] = review;
                return review;
            }
        );
        // Actual review management
        this.reviews = params.reviewInterfaces;
        ko.utils.arrayPushAll(this.reviews(), params.reviews.map(
            (review: Review) => {
                let sri = new SingleReviewInterface({
                    review: review,
                    parent: this, // Get actual proper review from ID
                    state: ReviewModelState.SAVED,
                    inherits: parseReviewInheritance(review)
                }, false);
                return sri;
            }
        ));
        // Views onto the reviews
        this.generalReviews = ko.pureComputed<SingleReviewInterface[]>(() => {
            return this.reviews().filter((sri: SingleReviewInterface): boolean => {
                return !sri.isLineReview();
            });
        });
        this.lineReviews = ko.pureComputed<SingleReviewInterface[]>(() => {
            return this.reviews().filter((sri: SingleReviewInterface): boolean => {
                return sri.isLineReview();
            });
        });
        // UI Seeing/Editing Stuff
        this.isGrader = params.isGrader;
        this.previewStudentMode = params.previewStudentMode;
        this.isLtiActive = ko.observable(params.isLtiActive);
        this.canSeeFeedback = params.canSeeFeedback;
        this.canEditFeedback = params.canEditFeedback;

        this.totalScore = ko.pureComputed<number>( () => {
            let totalReviewScore = this.reviews().map( (reviewInterface: SingleReviewInterface) =>
                reviewInterface.calculateScore() ? reviewInterface.calculateScore() : 0
            ).reduce( (score, total) => score+total, 0);
            return this.submission.score()*100 + totalReviewScore;
        });

        this.releaseFeedbackExplanation = ko.pureComputed<string>( () => explainGradingStatus(this.submission.gradingStatus()));
        this.releaseFeedbackColor = ko.pureComputed<string>( () => colorGradingStatus(this.submission.gradingStatus()));
        this.releaseFeedbackLabel = ko.pureComputed<string>( () => labelGradingStatus(this.submission.gradingStatus()));
        this.closeSubmissionExplanation = ko.pureComputed<string>(() => closeSubmissionStatus(this.submission.submissionStatus()));
        this.closeSubmissionColor = ko.pureComputed<string>( () => colorSubmissionStatus(this.submission.submissionStatus()));
        this.closeSubmissionLabel = ko.pureComputed<string>( () =>
            this.submission.checkSubmission(SubmissionStatus.COMPLETED) ?
                "Reopen submission" : "Close submission"
        );
        [this.canMarkCorrect, this.canMarkCheating] = DEFAULT_MARKS.map((mark) => {
            return ko.pureComputed<boolean>(() =>
                (undefined === this.reviews().find((review) =>
                    review.review.comment() === mark)))
        });

    }

    releaseFeedback() {
        showOverlay();
        let newStatus = !this.submission.checkGrading(GradingStatus.FULLY_GRADED) ?
            GradingStatus.FULLY_GRADED : GradingStatus.PENDING_MANUAL;
        let endpoint = window["$URL_ROOT"] + "grading/update_grading_status";
        $.post(endpoint, {
            submission_id: this.submission.id,
            new_grading_status: newStatus,
        }, (data) => {
            if (data.new_status) {
                this.submission.gradingStatus(data.new_status);
                $("#summary-grading-status-"+this.submission.id).text(data.new_status_human);
            } else {
                alert("Grading status update failed!\n"+JSON.stringify(data));
            }
        }).always(hideOverlay);
    }

    closeSubmission() {
        showOverlay();
        let newStatus = !this.submission.checkSubmission(SubmissionStatus.COMPLETED) ?
            SubmissionStatus.COMPLETED : SubmissionStatus.IN_PROGRESS;
        let endpoint = window["$URL_ROOT"] + "grading/update_submission_status";
        $.post(endpoint, {
            "submission_id": this.submission.id,
            "new_submission_status": newStatus,
        }, (data) => {
            if (data.new_status) {
                this.submission.submissionStatus(data.new_status);
                $("#summary-submission-status-"+this.submission.id).text(data.new_status_human);
            } else {
                alert("Submission status update failed!\n"+JSON.stringify(data));
            }
        }).always(hideOverlay);
    }

    addGeneralFeedback() {
        let draftReview = new Review({
            assignment_version: this.assignment.version(),
            author_id: this.author.id,
            comment: "New Comment",
            date_created: ""+new Date(),
            date_modified: ""+new Date(),
            forked_id: null,
            forked_version: null,
            generic: false,
            id: null,
            location: null,
            score: null,
            submission_id: this.submission.id,
            submission_version: this.submission.version(),
            tag_id: null,
            version: 0
        });
        let draftReviewInterface = new SingleReviewInterface({
            inherits: "nothing",
            parent: this,
            review: draftReview,
            state: ReviewModelState.DRAFT
        }, false);
        this.reviews.push(draftReviewInterface);
    }

    markAs(title: string) {
        const existingReview = this.reviews().find((review) => review.review.comment() === title);
        if (existingReview !== undefined) {
            return;
        }
        let score = title === "Passed human review" ? (100 - this.submission.score()*100) || 100 : -10000000;
        let draftReview = new Review({
            assignment_version: this.assignment.version(),
            author_id: this.author.id,
            comment: title,
            date_created: ""+new Date(),
            date_modified: ""+new Date(),
            forked_id: null,
            forked_version: null,
            generic: false,
            id: null,
            location: null,
            score: score,
            submission_id: this.submission.id,
            submission_version: this.submission.version(),
            tag_id: null,
            version: 0
        });
        let draftReviewInterface = new SingleReviewInterface({
            inherits: "nothing",
            parent: this,
            review: draftReview,
            state: ReviewModelState.DRAFT
        }, false);
        this.reviews.push(draftReviewInterface);
        this.server.reviewStore.create(draftReviewInterface.serialized()).then((savedReview: Review) => {
            draftReview.id = savedReview.id;
            draftReviewInterface.state(ReviewModelState.SAVED);
        });
    }
}
