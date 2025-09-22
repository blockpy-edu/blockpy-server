import {Assignment} from "../models/assignment";
import {GradingStatus, Submission, SubmissionStatus} from "../models/submission";


export function launchEditor(assignment: Assignment, submission: Submission) {
    var form = document.createElement("form");
    form.setAttribute("method", "post");
    form.setAttribute("action", window["$URL_ROOT"]+"blockpy/load_readonly");
    form.setAttribute("target", "_blank");

    // @ts-ignore
    const accessToken = window['accessToken'];

    let formData = {
        user: {
            role: "owner"
        },
        assignment: assignment ? assignment.toJson(): null,
        submission: submission ? submission.toJson(): null,
        // Matches JWT_JSON_KEY, which defaults to "access_token"
        access_token: accessToken,
        display_seed: submission ? submission.id : null
    };

    formData.assignment.forked_id = assignment.id;
    formData.assignment.forked_version = assignment.version();
    formData.assignment.id = null;
    formData.assignment.url = "";
    formData.assignment.course_id = null;
    formData.submission.id = null;
    formData.submission.endpoint = "";
    formData.submission.url = "";
    formData.submission.user_id = null;
    formData.submission.course_id = null;
    formData.submission.assignment_id = null;
    formData.submission.grading_status = GradingStatus.NOT_READY;
    formData.submission.submission_status = SubmissionStatus.IN_PROGRESS;

    var hiddenField = document.createElement("input");
    hiddenField.setAttribute("type", "hidden");
    hiddenField.setAttribute("name", "assignment_data");
    hiddenField.setAttribute("value", JSON.stringify(formData, null, 2));
    form.appendChild(hiddenField);
    document.body.appendChild(form);

    //window.open('', '_blank');

    form.submit();
}