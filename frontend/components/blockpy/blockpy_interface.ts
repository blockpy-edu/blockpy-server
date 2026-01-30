/**
 * Despite what you might think, this currently does not
 * have the actual UI stuff for BlockPy's client. That lives in
 * the Blockpy repo and is injected via a different div, in the editor.html
 * template. The interface from this file is actually not visible,
 * and is just used for tracking certain kinds of events, e.g., the exam
 * timer and the window hidden/show.
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


ko.components.register("blockpy", {
    viewModel: BlockPyInterface,
    template: "<div style=''>SECRET</div>"
});
