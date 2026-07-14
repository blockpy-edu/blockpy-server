/**
 * Despite what you might think, this currently does not
 * have the actual UI stuff for BlockPy's client. That lives in
 * the Blockpy repo and is injected via a different div, in the editor.html
 * template. The interface from this file is actually not visible,
 * and is just used for tracking certain kinds of events, e.g., the exam
 * timer and the window hidden/show.
 * 
 * Additionally, this component now includes the question/help button
 * that allows students to ask questions about assignments.
 */

import * as ko from 'knockout';
import {ajax_post} from "../../services/ajax";
import {Server} from "../../services/server";
import {User} from "../../models/user";
import {Assignment} from "../../models/assignment";
import {Submission} from "../../models/submission";
import {AssignmentInterface, AssignmentInterfaceJson, EditorMode} from "../assignment_interface";
import {STORAGE_SERVICE} from "../../utilities/safe_local_storage";
import {Reader} from "../reader/reader";


export class BlockPyInterface extends AssignmentInterface {
    private settings: Record<string, string>;
    subscriptions: {
        currentAssignmentId: ko.Subscription,
    }

    constructor(params: AssignmentInterfaceJson) {
        super(params);
        this.subscriptions = {currentAssignmentId: null};

        this.subscriptions.currentAssignmentId = this.currentAssignmentId.subscribe((newId) => {
            this.loadBlockPy(newId);
        }, this);
        // console.log(this.currentAssignmentId());
        this.loadBlockPy(this.currentAssignmentId());
    }

    loadBlockPy(assignmentId: number) {
        // console.log("FIRE?", assignmentId);
        if (assignmentId != null) {
            // console.log("Loading BlockPy for assignment ID", assignmentId);
            let BlockPyServer = window['$MAIN_BLOCKPY_EDITOR'].components.server;
            const assignment = window["$MAIN_BLOCKPY_EDITOR"].model.assignment;
            const submission = window["$MAIN_BLOCKPY_EDITOR"].model.submission;
            this.assignment({
                ...assignment,
                id: assignmentId,
                settings: ko.observable(assignment.rawSettings),
            });
            this.submission({
                ...submission,
                id: submission.id()
            });
            this.settings = assignment.rawSettings;
            // console.log("Submission", this.submission());
            this.handleTimeCheck();
        }
    }
}

const QUESTION_BUTTON_TEMPLATE = `
<!-- Question/Help Button -->
<div id="ask-question-button" style="position: fixed; bottom: 20px; right: 20px; z-index: 9999;">
    <button class="btn btn-primary btn-lg" data-bind="click: showQuestionModal" title="Ask a question about this assignment">
        <i class="fas fa-question-circle"></i>
    </button>
</div>

<!-- Question Modal -->
<div class="modal fade" id="question-modal" tabindex="-1" role="dialog">
    <div class="modal-dialog modal-lg" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">Ask a Question</h5>
                <button type="button" class="close" data-dismiss="modal">
                    <span>&times;</span>
                </button>
            </div>
            <div class="modal-body">
                <p class="text-muted">
                    Ask your instructor a question about this assignment. You can use Markdown formatting.
                </p>
                <div class="form-group">
                    <label for="question-title">Title:</label>
                    <input type="text" class="form-control" id="question-title" 
                           data-bind="value: questionTitle"
                           placeholder="Brief description of your question">
                </div>
                <div class="form-group">
                    <label for="question-content">Question Details:</label>
                    <textarea class="form-control" id="question-content" rows="8"
                              data-bind="value: questionContent"
                              placeholder="Describe your question in detail..."></textarea>
                </div>
                <div class="form-check">
                    <input type="checkbox" class="form-check-input" id="include-code"
                           data-bind="checked: includeCode">
                    <label class="form-check-label" for="include-code">
                        Include my current code with this question
                    </label>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-dismiss="modal">Cancel</button>
                <button type="button" class="btn btn-primary" data-bind="click: submitQuestion">Submit Question</button>
            </div>
        </div>
    </div>
</div>
`;

ko.components.register("blockpy", {
    viewModel: BlockPyInterface,
    template: QUESTION_BUTTON_TEMPLATE
});
