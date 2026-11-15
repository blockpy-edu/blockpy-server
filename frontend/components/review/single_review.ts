/**
 * One review (general or attached to a line) of one submission, with its
 * editing state and the calls that create, update, and remove it on the server.
 */
import {Review, ReviewJson} from "../../models/review";
import * as ko from 'knockout';
import {InheritOptions, ReviewModelState, Tag} from "./types";
import type {SubmissionReviewInterface} from "./submission_review";

export interface SingleReviewInterfaceJson {
    review: Review;
    parent: SubmissionReviewInterface;
    state: ReviewModelState;
    inherits: string;
}

export class SingleReviewInterface {
    // The review is always the same, never changes
    review: Review;
    parent: SubmissionReviewInterface;
    state: KnockoutObservable<ReviewModelState>;
    inherits: KnockoutObservable<string>;
    private getScoreText: KnockoutReadonlyComputed<string>;
    getScore: KnockoutReadonlyComputed<number>;
    private getText: KnockoutReadonlyComputed<string>;

    constructor(params: SingleReviewInterfaceJson, startSaved: boolean) {
        this.review = params.review;
        this.parent = params.parent;
        if (startSaved) {
            this.state = ko.observable(ReviewModelState.SAVED);
        } else {
            this.state = ko.observable(params.state);
        }
        this.inherits = ko.observable(params.inherits);
        // If we change inherits type, then clear out other settings
        this.inherits.subscribe(this.clearOtherInherits.bind(this));
        this.getScoreText = ko.pureComputed<string>( ()=>this.calculateScoreText());
        this.getScore = ko.pureComputed<number>( () => this.calculateScore());
        this.getText = ko.pureComputed<string>( ()=> this.calculateText());
    }

    isLineReview(): boolean {
        return this.review.location() !== "" && this.review.location() !== null;
    }

    isEditing(): boolean {
        return this.state() === ReviewModelState.EDITING || this.state() === ReviewModelState.DRAFT;
    }

    clearOtherInherits(newInheritMode: string) {
        if (newInheritMode === InheritOptions.REVIEW) {
            this.review.tagId(null);
        } else if (newInheritMode === InheritOptions.TAG) {
            this.review.forkedId(null);
        } else {
            this.review.tagId(null);
            this.review.forkedId(null);
        }
    }

    calculateScoreText(): string {
        let score = this.calculateScore();
        if (score > 0) {
            return "+"+score;
        } else if (score == null) {
            return "";
        } else {
            return ""+score;
        }
    }

    calculateScore(): number {
        let score = this.review.score();
        if (score === null) {
            let parent = this.getParentReview();
            if (parent !== null) {
                score = parent.score();
            }
        } else {
            score = parseInt(""+score, 10);
        }
        return score;
    }

    getParentReview(): Review|null {
        let genericReviewId = this.review.forkedId();
        if (genericReviewId === null) {
            return null;
        }
        let genericReview = this.parent.lookupGenericReviews[genericReviewId];
        if (genericReview != null) {
            return genericReview;
        } else {
            return null;
        }
    }

    getParentTag(): Tag|null {
        let tagId = this.review.tagId();
        if (tagId === null) {
            return null;
        }
        let tag = this.parent.lookupTags[tagId];
        if (tag != null) {
            return tag;
        } else {
            return null;
        }
    }

    calculateText(): string {
        let text = this.review.comment();
        switch (this.inherits()) {
            case "nothing": return text;
            case "tag":
                let tag = this.getParentTag();
                if (tag !== null) {
                    text = tag.name+(text ? "- "+text : "");
                }
                return text;
            case "review":
                let parent = this.getParentReview();
                if (parent !== null) {
                    text = parent.comment()+(text ? "- "+text : "");
                }
                return text;
        }
    }

    remove() {
        this.parent.server.reviewStore.remove(this.review).then(() => {
            this.parent.reviews.remove(this);
        });
    }

    edit() {
        this.state(ReviewModelState.EDITING);
    }

    create() {
        this.parent.server.reviewStore.create(this.serialized()).then((savedReview: Review) => {
            this.review.id = savedReview.id;
            this.state(ReviewModelState.SAVED);
        });
    }

    update() {
        this.parent.server.reviewStore.update(this.serialized()).then((savedReview: Review) => {
            this.state(ReviewModelState.SAVED);
        });
    }

    cancel() {
        switch (this.state()) {
            case ReviewModelState.EDITING:
                // Persist change to server
                this.state(ReviewModelState.SAVED);
                break;
            case ReviewModelState.DRAFT:
                this.parent.reviews.remove(this);
                break;
        }
    }

    save() {
        if (this.state() === ReviewModelState.DRAFT) {
            this.create();
        } else {
            this.update();
        }
    }

    serialized(): Partial<ReviewJson> {
        let tag_id, forked_id;
        console.log(this.review.tagId(), this.review.forkedId());
        tag_id = this.review.tagId() != null ? this.review.tagId() : null;
            forked_id = this.review.forkedId() != null ? this.review.forkedId() : null;
            if (tag_id && forked_id) {
                tag_id = null;
            }
        if (this.inherits() !== undefined) {
            if (this.inherits() === 'tag') {
                forked_id = null;
            } else if (this.inherits() ==='review') {
                tag_id = null;
            } else {
                forked_id = null;
                tag_id = null;
            }
        }
        return {
            id: this.review.id,
            comment: this.review.comment(),
            generic: this.review.generic(),
            location: this.review.location(),
            tag_id: tag_id,
            score: (this.review.score() == null) ? null : this.review.score(),
            author_id: this.review.authorId(),
            assignment_version: this.review.assignmentVersion(),
            submission_version: this.review.submissionVersion(),
            version: this.review.version(),
            forked_id: forked_id,
            date_created: this.review.dateCreated(),
            submission_id: this.review.submissionId(),
            forked_version: this.review.forkedVersion()
        };
    };
}
