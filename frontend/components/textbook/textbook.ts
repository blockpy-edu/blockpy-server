/***
 * Textbooks are essentially just an interface for navigating a bunch
 * of Readings. The readings are provided via their URLs, and can be
 * indented relative to each other with headings and such.
 *
 * The page is responsive on mobile, and should have some form of bookmarking
 * and hyperlinking.
 */

import * as ko from 'knockout';
import {AssignmentInterface, AssignmentInterfaceJson, EditorMode} from "../assignment_interface";

interface TextbookReadingJson {
    id: number
    url: string
    missing: boolean
    name: string
}

interface TextbookGroupJson {
    id: number
    url: string
    missing: boolean
    name: string
}

interface TextbookContentJson {
    header?: string
    reading?: TextbookReadingJson
    group?: TextbookGroupJson
    content?: TextbookContentJson[]
}

interface TextbookJson {
    settings: Record<string, any>
    version: number
    content: TextbookContentJson
}

interface TextbookInterfaceJson extends AssignmentInterfaceJson {
    textbook: TextbookJson
}

export class TextbookContentViewModel {
    content: TextbookContentJson
    constructor(params: {content: TextbookContentJson}) {
        this.content = params.content;
    }
}

export class Textbook extends AssignmentInterface {
    errorMessage: ko.Observable<string>;
    editorMode: ko.Observable<EditorMode>;
    textbook: TextbookJson;

    subscriptions: {
        currentAssignmentId: ko.Subscription,
    }

    constructor(params: TextbookInterfaceJson) {
        super(params);
        console.log(params.textbook);
        this.subscriptions = {currentAssignmentId: null};
        this.editorMode = ko.observable(EditorMode.SUBMISSION);
        this.errorMessage = ko.observable("");
        this.textbook = params.textbook;

        this.subscriptions.currentAssignmentId = this.currentAssignmentId.subscribe((newId) => {
            this.loadTextbook(newId);
        }, this);
        this.loadTextbook(this.currentAssignmentId());
    }

    loadTextbook(assignmentId: number) {
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
                        this.parseAdditionalSettings();
                    } else {
                        console.error("Failed to load", response);
                        this.assignment(null);
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

    parseAdditionalSettings() {
        let settingsRaw = this.assignment().settings();
        let settings = JSON.parse(settingsRaw || "{}");
    }

    dispose() {
        super.dispose();
        this.subscriptions.currentAssignmentId.dispose();
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

    /*markRead() {
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
                    //console.log(response.message.feedbacks);
                    if (response.success || response.message.message === "Generic LTI Failure - perhaps not logged into LTI session?") {
                        //console.log(response);
                    }
                    if (!response.success) {
                        console.error(response);
                        this.errorMessage(response.message.message);
                    }
                    this.submission().submissionStatus(response.submission_status);
                    this.submission().correct(response.correct);
                    if (response.correct) {
                        this.markCorrect(this.assignment().id);
                    }
               },
               (e: any, textStatus: string, errorThrown: any) => {
                    console.error("Failed to load (HTTP LEVEL)", e, textStatus, errorThrown);
                    this.errorMessage("HTTP ERROR (try reloading the page; if still an error, report to instructor!): "+ textStatus+"\n"+errorThrown);
                });
    }*/
}

export const EDITOR_HTML = `
<!-- Errors -->
<div class="alert alert-warning p-1 border rounded float-right" data-bind="text: errorMessage, visible: errorMessage().length"></div>

<!-- Instructor Editor Mode Selector -->
<div data-bind="if: isInstructor()">
    <!-- Instructor Editor Mode Selector -->
    <div class="form-check">
        <label class="form-check-label">
            <input data-bind="checked: editorMode"
               id="textbook-editor-mode-radio" name="textbook-editor-mode-radio"
               class="form-check-input" type="radio" value="RAW">
            Raw Editor
        </label>
    </div>
    <div class="form-check">
        <label class="form-check-label">
            <input data-bind="checked: editorMode"
                   id="textbook-editor-mode-radio" name="textbook-editor-mode-radio"
                   class="form-check-input" type="radio" value="FORM">
            Form Editor
        </label>
    </div>
    <div class="form-check">
        <label class="form-check-label">
            <input data-bind="checked: editorMode"
               id="textbook-editor-mode-radio" name="textbook-editor-mode-radio"
               class="form-check-input" type="radio" value="SUBMISSION">
            Actual Textbook
        </label>
    </div>
    
    <!-- Raw Instructor Editor -->
    <div data-bind="if: editorMode() === 'RAW'">
        <button data-bind="click: saveAssignment">Save Assignment</button><br>
        <h6>Instructions</h6>
        <textarea data-bind="textInput: assignment().instructions" style="width: 100%; height: 300px"></textarea><br>
        <h6>Settings</h6>
        <textarea data-bind="textInput: assignment().settings" style="width: 100%; height: 300px"></textarea><br>
    </div>

    <!-- Form Instructor Editor -->
    <div data-bind="if: editorMode() === 'FORM'">
        <button data-bind="click: saveAssignment">Save Assignment</button><br>
        <!-- Actual Contents -->
        <h6>Instructions (Body)</h6>
        <div data-bind="jsoneditor: {value: assignment().instructions}" style="width: 100%; height: 500px; resize: vertical; overflow: auto"></div><br>
        <!-- Other settings -->
        <div class="form-group">
            <label for="textbook-points-editor">
                Points:
                <input type="number" id="textbook-points-editor" name="textbook-points-editor"
                    class="form-control" data-bind="value: assignment().points">
            </label>
        </div>
        <div class="form-group">
            <label for="textbook-name-editor">
                Name:
                <input type="text" id="textbook-name-editor" name="textbook-name-editor"
                    class="form-control" data-bind="value: assignment().name">
            </label>
        </div>
        <div class="form-group">
            <label for="textbook-url-editor">
                URL:
                <input type="text" id="textbook-url-editor" name="textbook-url-editor"
                    class="form-control" data-bind="value: assignment().url">
            </label>
        </div>
        <h6>Additional Settings</h6>
        <div data-bind="jsoneditor: {value: assignment().settings}" style="width: 100%; height: 300px"></div><br>
        <h6>Assignment Files</h6>
        <div data-bind="filepond: {server: server, submission: submission, assignment: assignment}"></div><br>
    </div>
</div>
`;


export const TEXTBOOK_HTML = `
<div>
    Testing
    ${EDITOR_HTML}
    <!-- Body -->
    <div  style="background: #FBFAF7" class="pt-4 p-4">
        <div data-bind="foreach: textbook.content">
            <textbook-content params="content: $data"></textbook-content>
        </div>
        <hr>
    </div>
</div>
`

export const TEXTBOOK_CONTENT_HTML = `
<textbook-content>
    <span data-bind="text: JSON.stringify($data)"></span>
    <!-- ko if: $data.header -->
    <h3 data-bind="text: $data.header"></h3>
    <!-- /ko -->
    
</div>
`;
/*
<!-- ko if: $data.content && $data.content.length -->
    <div data-bind="foreach: content">
        <textbook-content params="content: $data"></textbook-content>
    </div>
    <!-- /ko -->
 */

ko.components.register("textbook-content", {
    template: TEXTBOOK_CONTENT_HTML
})

ko.components.register("textbook", {
    viewModel: Textbook,
    template: TEXTBOOK_HTML
});
