/**
 * The quick button and popover shown beside each line of a submission's code,
 * for adding, reading, and editing the review attached to that line.
 */
import {Review} from "../../models/review";
import * as ko from 'knockout';
import {ReviewModelState} from "./types";
import {SingleReviewInterface} from "./single_review";
import type {SubmissionReviewInterface} from "./submission_review";

function findReviewByLocation(reviews: KnockoutObservableArray<SingleReviewInterface>, location: number): SingleReviewInterface|null {
    let potentialReview = reviews().find((review: SingleReviewInterface) => parseInt(review.review.location(), 10) === location);
    return potentialReview || null;
}

export class LineReviewInterfaceJson {
    location: number;
    reviews: KnockoutObservableArray<SingleReviewInterface>;
    isGrader: KnockoutObservable<boolean>;
    canSeeFeedback: KnockoutReadonlyComputed<boolean>;
    canEditFeedback: KnockoutReadonlyComputed<boolean>;
    parent: KnockoutObservable<SubmissionReviewInterface>;
}

export class LineReviewInterface {
    location: KnockoutObservable<number>;
    reviewInterface: KnockoutReadonlyComputed<SingleReviewInterface>;
    private quickButtonIcon: KnockoutReadonlyComputed<string>;
    isGrader: KnockoutObservable<boolean>;
    canSeeFeedback: KnockoutReadonlyComputed<boolean>;
    canEditFeedback: KnockoutReadonlyComputed<boolean>;
    parent: KnockoutObservable<SubmissionReviewInterface>;

    constructor(params: LineReviewInterfaceJson) {
        this.parent = params.parent;
        this.location = ko.observable(params.location);
        this.reviewInterface = ko.pureComputed(() => findReviewByLocation(params.reviews, this.location()));
        this.isGrader = params.isGrader;
        this.canSeeFeedback = params.canSeeFeedback;
        this.canEditFeedback = params.canEditFeedback;

        this.quickButtonIcon = ko.pureComputed(() => {
            const reviewInterface = this.reviewInterface();
            if (reviewInterface === null) {
                if (this.isGrader()) {
                    return "fa-plus-circle";
                } else {
                    return "fa-circle";
                }
            }
            switch (reviewInterface.state()) {
                case ReviewModelState.DRAFT:
                    return "fa-save";
                case ReviewModelState.EDITING:
                    return "fa-save";
                case ReviewModelState.SAVED:
                    return "fa-chevron-circle-right";
                case ReviewModelState.EXPANDED:
                    return "fa-chevron-circle-left";
            }
        });
    }

    addLineFeedback() {
        let location = this.location();
        if (!this.reviewInterface()) {
            let draftReview = new Review({
                assignment_version: this.parent().assignment.version(),
                author_id: this.parent().author.id,
                comment: "New Comment",
                date_created: ""+new Date(),
                date_modified: ""+new Date(),
                forked_id: null,
                forked_version: null,
                generic: false,
                id: null,
                location: ""+location,
                score: null,
                submission_id: this.parent().submission.id,
                submission_version: this.parent().submission.version(),
                tag_id: null,
                version: 0
            });
            let draftReviewInterface = new SingleReviewInterface({
                inherits: "nothing",
                parent: this.parent(),
                review: draftReview,
                state: ReviewModelState.DRAFT
            }, false);
            this.parent().reviews.push(draftReviewInterface);
        }
    }

    collapse() {
        this.reviewInterface().state(ReviewModelState.COLLAPSED);
    }

    edit() {
        if (this.reviewInterface()) {
            if (this.reviewInterface().state() === ReviewModelState.EDITING) {
                this.reviewInterface().state(ReviewModelState.EXPANDED);
            } else {
                this.reviewInterface().state(ReviewModelState.EDITING);
            }
        }
    }

    remove() {
        if (this.reviewInterface()) {
            this.reviewInterface().remove();
        }
    }

    quickButtonClick(component: any, event: any) {
        if (!this.canEditFeedback()) {
            if (this.reviewInterface()) {
                this.takeFocus(null, {currentTarget: event.currentTarget.nextElementSibling});
            }
            return;
        }
        if (this.reviewInterface() === null) {
            this.addLineFeedback();
            this.takeFocus(null, {currentTarget: event.currentTarget.nextElementSibling});
            return;
        }
        switch (this.reviewInterface().state()) {
            case ReviewModelState.DRAFT:
                this.reviewInterface().create();
                break;
           case ReviewModelState.EDITING:
                this.reviewInterface().update();
                break;
            case ReviewModelState.SAVED:
                this.reviewInterface().state(ReviewModelState.EDITING);
                break;
            case ReviewModelState.EXPANDED:
                this.reviewInterface().state(ReviewModelState.EDITING);
                break;
        }
    }

    fixPopoverPosition(elements: HTMLElement[]) {
        let popover, button;
        elements.map((element) => {
            if (element.classList) {
                if (element.classList.contains("popover")) {
                    popover = element;
                }
                if (element.classList.contains("line-review-quick-button")) {
                    button = element;
                }
            }
        });
        let offset = $(button).offset();
        let width = $(button).width()+5;
        $(popover).offset({"top": -$(button).height()/2+5, "left": width});
        //popover.style.top = -$(button).height()/2;
        //popover.style.left = width;
        $(popover).show();
    }

    takeFocus = (component: any, event: any) => {
        $(".popover").css({"z-index": 1060});
        $(event.currentTarget).css({"z-index": 1061});
    };
}
