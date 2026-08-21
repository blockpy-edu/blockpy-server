import * as ko from 'knockout';
import {AssignmentInterface, AssignmentInterfaceJson, EditorMode} from "../assignment_interface";
import FEEDBACK_HTML from "./feedback.html";
import EDITOR_HTML from "./editor.html";

export const LOG_TIME_RATE = 30000;

export interface FeedbackSubmission {
    contents?: string;
    published?: boolean;
}

export const EMPTY_FEEDBACK_SUBMISSION_STRING = JSON.stringify({
    contents: "",
    published: false
});

export function fillInMissingFeedbackSubmissionFields(feedbackSubmission: FeedbackSubmission) {
    feedbackSubmission.contents ??= "";
    feedbackSubmission.published ??= false;
}

interface FeedbackInterfaceJson extends AssignmentInterfaceJson {
    asPreamble: boolean
}

export class FeedbackViewer extends AssignmentInterface {
    logTimer: NodeJS.Timeout;
    logCount: number;
    oldPosition: number;

    contents: ko.Observable<string>;
    published: ko.Observable<boolean>;

    asPreamble: ko.Observable<boolean>;

    errorMessage: ko.Observable<string>;
    editorMode: ko.Observable<EditorMode>;

    subscriptions: {
        currentAssignmentId: ko.Subscription,
        windowPositioning: (event: Event) => void
    }

    constructor(params: FeedbackInterfaceJson) {
        super(params);
        this.subscriptions = {currentAssignmentId: null, windowPositioning: null};
        this.logCount = 0;
        this.oldPosition = null;

        this.contents = ko.observable<string>("");
        this.published = ko.observable<boolean>(false);
        this.asPreamble = ko.observable<boolean>(params.asPreamble || false);

        this.editorMode = ko.observable(EditorMode.SUBMISSION);
        this.errorMessage = ko.observable("");

        this.subscriptions.currentAssignmentId = this.currentAssignmentId.subscribe((newId) => {
            this.loadFeedback(newId);
        }, this);
        this.loadFeedback(this.currentAssignmentId());

        this.subscriptions.windowPositioning = this.getWindowPositioning.bind(this)
        window.addEventListener('message', this.subscriptions.windowPositioning);
    }

    loadFeedback(assignmentId: number) {
        if (assignmentId != null) {
            let BlockPyServer = window['$MAIN_BLOCKPY_EDITOR'].components.server;
            let data = BlockPyServer.createServerData();
            data["assignment_id"] = assignmentId;
            this.assignment(null);
            BlockPyServer._postBlocking("loadAssignment", data, 4,
                (response: any) => {
                    if (response.success) {
                        let assignment = this.server.assignmentStore.newInstance(response.assignment);
                        let submission = response.submission ? this.server.submissionStore.newInstance(response.submission) : null;
                        this.assignment(assignment);
                        this.submission(submission);
                        this.parseSubmission();
                        this.logCount = 1;
                        this.logTimer = setTimeout(this.logReadingStart.bind(this), 1000);
                        if (response.submission) {
                            this.markRead();
                        }
                        this.handleTimeCheck();
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

    parseSubmission() {
        const code = (this.submission() && this.submission().code()) ? this.submission().code() : EMPTY_FEEDBACK_SUBMISSION_STRING;
        let feedbackSubmission: FeedbackSubmission;
        try {
            feedbackSubmission = JSON.parse(code) as FeedbackSubmission;
        } catch (e) {
            console.error("Failed to parse feedback submission", code, e);
            feedbackSubmission = {};
        }
        fillInMissingFeedbackSubmissionFields(feedbackSubmission);
        this.contents(feedbackSubmission.contents);
        this.published(feedbackSubmission.published);
    }

    submissionAsJson(): string {
        return JSON.stringify({
            contents: this.contents(),
            published: this.published()
        }, null, 2);
    }

    saveSubmission() {
        const code = this.submissionAsJson();
        this.saveFile("answer.py", code, true, () => {
            this.submission().code(code);
        });
    }

    saveSubmissionRaw() {
        this.saveFile("answer.py", this.submission().code(), true, () => {
            this.parseSubmission();
        });
    }

    dispose() {
        super.dispose();
        this.subscriptions.currentAssignmentId.dispose();
        window.removeEventListener('message', this.subscriptions.windowPositioning);
    }

    getWindowPositioning(event: any) {
        let data = (typeof event.data === "string") ? JSON.parse(event.data) : event.data;
        if (data.subject === "lti.fetchWindowSize" || data.subject === "lti.fetchWindowSize.response") {
            this.logReading(data);
        }
    }

    logReadingStart(assignmentId: number) {
        window.top.postMessage({subject: "lti.fetchWindowSize"}, "*");
    }

    logReading(positionData: any) {
        this.logCount += 1;
        let delay = this.logCount * LOG_TIME_RATE;
        let position: number, height;
        if (positionData != null && 'offset' in positionData) {
            position = positionData.scrollY;
            height = $(document).height() + positionData.offset.top;
        } else {
            position = $(document).scrollTop();
            height = $(document).height();
        }
        const moved = position !== this.oldPosition;
        let progress = 100* position / height;
        if (this.assignment() && this.submission()) {
            // The `reading` category is retained so that read-time counters
            // (SubmissionCounts) accumulate for feedback assignments too.
            this.logEvent("Resource.View", "reading", "read",
                JSON.stringify({
                    "count": this.logCount,
                    delay, position, height, progress, moved
                }), this.assignment().url(), () => {
                    this.logTimer = setTimeout(this.logReadingStart.bind(this), delay);
                    this.oldPosition = position;
                })
        } else {
            console.log("Skipping log event");
        }
    }

    saveAssignment() {
        this.saveFile("!instructions.md", this.assignment().instructions(), true, ()=>{});
        this.saveAssignmentSettings({
            settings: this.assignment().settings(),
            points: this.assignment().points(),
            url: this.assignment().url(),
            name: this.assignment().name()
        });
    }

    markRead() {
        let BlockPyServer = window['$MAIN_BLOCKPY_EDITOR'].components.server;
        let now = new Date();
        let data = {
            assignment_id: this.assignment().id,
            assignment_group_id: this.assignmentGroupId,
            course_id: this.courseId,
            submission_id: this.submission().id,
            user_id: this.user.id,
            status: 1,
            correct: true,
            timestamp: now.getTime(),
            timezone: now.getTimezoneOffset(),
            passcode: window['$MAIN_BLOCKPY_EDITOR'].model.display.passcode(),
        };
        BlockPyServer._postBlocking("updateSubmission", data, 3,
               (response: any) => {
                    if (!response.success && response.message.message !== "Generic LTI Failure - perhaps not logged into LTI session?") {
                        console.error(response);
                        this.errorMessage(response.message.message);
                    }
                    this.submission().submissionStatus(response.submission_status);
                    this.submission().correct(response.correct);
                    if (response.correct && this.markCorrect) {
                        this.markCorrect(this.assignment().id);
                    }
               },
               (e: any, textStatus: string, errorThrown: any) => {
                    console.error("Failed to load (HTTP LEVEL)", e, textStatus, errorThrown);
                    this.errorMessage("HTTP ERROR (try reloading the page; if still an error, report to instructor!): "+ textStatus+"\n"+errorThrown);
                });
    }
}

const FULL_HTML = `
<div data-bind="if: assignment">
    ${EDITOR_HTML}
    ${FEEDBACK_HTML}
</div>
`

ko.components.register("feedback-viewer", {
    viewModel: FeedbackViewer,
    template: FULL_HTML
});
