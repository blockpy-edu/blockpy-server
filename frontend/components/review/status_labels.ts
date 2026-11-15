/**
 * The wording, colors, and explanations for the two status buttons in the
 * submission review controls: closing/reopening a submission, and publishing
 * or hiding its feedback.
 */
import {GradingStatus, SubmissionStatus} from "../../models/submission";

export function closeSubmissionStatus(status: SubmissionStatus) {
    switch (status.toLowerCase()) {
        case SubmissionStatus.COMPLETED.toLowerCase(): case SubmissionStatus.SUBMITTED.toLowerCase():
            return "This assignment is closed or already completed, so the student cannot edit the assignment further.<br>Use this button to reopen the assignment.<br>";
        default:
            return "This assignment is currently OPEN for the student to edit.<br>Use this button to close the assignment.<br>";
    }
}

export function colorSubmissionStatus(status: SubmissionStatus) {
    switch (status.toLowerCase()) {
        case SubmissionStatus.COMPLETED.toLowerCase(): case SubmissionStatus.SUBMITTED.toLowerCase():
            return "btn-info";
        default:
            return "btn-success";
    }
}

export function explainGradingStatus(status: GradingStatus) {
    switch (status.toLowerCase()) {
        case GradingStatus.FULLY_GRADED.toLowerCase():
           return "<strong>Submission is currently graded and the feedback is visible to them</strong> (unless the assignment is hidden in the LMS).<br>Use this button to hide and make further changes to their feedback.<br>";
       case GradingStatus.PENDING_MANUAL.toLowerCase(): case GradingStatus.PENDING.toLowerCase():
           return "<strong>Feedback is currently hidden while you add more feedback</strong>.<br>Use this button to release the feedback to the student and update their grade in Canvas.<br>";
       case GradingStatus.FAILED.toLowerCase():
           return "Something went wrong during the grading upload. Check your internet connection, make sure you have recently opened the BlockPy dashboard, and try again.<br>";
       case GradingStatus.NOT_READY.toLowerCase():
           return "<strong>Feedback is currently hidden while you add more feedback</strong>. They might still be working on the assignment.<br>Use this button to release the feedback to the student and update their grade in Canvas.<br>";
    }
}

export function colorGradingStatus(status: GradingStatus) {
    switch (status.toLowerCase()) {
        case GradingStatus.FULLY_GRADED.toLowerCase():
           return "btn-info";
       case GradingStatus.PENDING_MANUAL.toLowerCase(): case GradingStatus.PENDING.toLowerCase():
           return "btn-success";
       case GradingStatus.FAILED.toLowerCase():
           return "btn-danger";
       case GradingStatus.NOT_READY.toLowerCase():
           return "btn-warning";
    }
}

export function labelGradingStatus(status: GradingStatus) {
    switch (status.toLowerCase()) {
        case GradingStatus.FULLY_GRADED.toLowerCase():
           return "Hide and revise feedback";
       case GradingStatus.PENDING_MANUAL.toLowerCase(): case GradingStatus.PENDING.toLowerCase():
           return "Publish feedback to students";
       case GradingStatus.FAILED.toLowerCase():
           return "Failed to release feedback!";
       case GradingStatus.NOT_READY.toLowerCase():
           return "Publish feedback to students early";
    }
}
