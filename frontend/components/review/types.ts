/**
 * The small shared vocabulary of the review interfaces: the UI state of one
 * review, what a review inherits its text and score from, and the tag shape.
 */
import {Review} from "../../models/review";

export enum ReviewModelState {
    DRAFT= "DRAFT",
    SAVED= "SAVED",
    EDITING= "EDITING",
    EXPANDED= "EXPANDED",
    COLLAPSED= "COLLAPSED"
}


export class Tag {
    id: number;
    name: string;
    kind: string;
    description: string;
    level: string;
    version: number;
    ownerId: number;
    courseId: number;
}

export enum InheritOptions {
    NOTHING="nothing",
    TAG="tag",
    REVIEW="review"
}

export function parseReviewInheritance(review: Review): InheritOptions {
    if (review.tagId() != null) {
        return InheritOptions.TAG;
    } else if (review.forkedId() != null) {
        return InheritOptions.REVIEW;
    } else {
        return InheritOptions.NOTHING;
    }
}
