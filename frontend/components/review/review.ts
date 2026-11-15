/**
 * The Review interface is how graders attach feedback and score adjustments to
 * a submission, and how students read them. Importing this module registers
 * four Knockout components:
 *
 *  - `submission-review-interface`: the main panel for one submission
 *    (submission_review.ts)
 *  - `line-review`: the per-line quick button and popover (line_review.ts)
 *  - `individual-review-editor` and `individual-review-show`: the edit form and
 *    the read-only row for one review; template-only, bound to a
 *    SingleReviewInterface (single_review.ts)
 *
 * They are mounted by `templates/reports/reviewing_interface.html`.
 */
import * as ko from 'knockout';
import {LineReviewInterface} from "./line_review";
import {SubmissionReviewInterface} from "./submission_review";

import SUBMISSION_REVIEW_INTERFACE_TEMPLATE from "./submission_review.html";
import INDIVIDUAL_REVIEW_EDITOR_TEMPLATE from "./review_editor.html";
import INDIVIDUAL_REVIEW_SHOW_TEMPLATE from "./review_show.html";
import LINE_REVIEW_BUTTON_TEMPLATE from "./line_review.html";

export * from "./types";
export * from "./status_labels";
export * from "./single_review";
export * from "./line_review";
export * from "./submission_review";
export {SUBMISSION_REVIEW_INTERFACE_TEMPLATE, INDIVIDUAL_REVIEW_EDITOR_TEMPLATE,
        INDIVIDUAL_REVIEW_SHOW_TEMPLATE, LINE_REVIEW_BUTTON_TEMPLATE};

ko.components.register("individual-review-editor", {
    template: INDIVIDUAL_REVIEW_EDITOR_TEMPLATE
});

ko.components.register("individual-review-show", {
    template: INDIVIDUAL_REVIEW_SHOW_TEMPLATE
});

ko.components.register("line-review", {
    viewModel: LineReviewInterface,
    template: LINE_REVIEW_BUTTON_TEMPLATE
});

ko.components.register("submission-review-interface", {
    viewModel: SubmissionReviewInterface,
    template: SUBMISSION_REVIEW_INTERFACE_TEMPLATE
});
