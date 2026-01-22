import * as ko from "knockout";
import { Server } from "../services/server";
import { User } from "../models/user";
import { Assignment } from "../models/assignment";
import { Submission } from "../models/submission";
import { formatAmount } from "../utilities/dates";
import { formatClock } from "../utilities/text";
import { generateUUID } from "../utilities/random";

export interface AssignmentInterfaceJson {
    server: Server;
    courseId: number;
    user: User;
    currentAssignmentId: ko.Observable<number>;
    assignmentGroupId: number;
    isInstructor: boolean | ko.Observable<boolean>;
    markCorrect: (id: number) => void;
}

function parseTimeLimit(
    timeLimit: string,
    studentLimit: string | null
): number {
    let modifier = 1;
    if (studentLimit) {
        if (studentLimit.includes("min")) {
            return parseInt(studentLimit.replace("min", "").trim()) * 60;
        } else if (studentLimit.includes("x")) {
            modifier = parseFloat(studentLimit.replace("x", "").trim());
        } else {
            console.error("Unknown time limit format", studentLimit);
        }
    }
    if (timeLimit.includes("min")) {
        let minutes = parseInt(timeLimit.replace("min", "").trim());
        return minutes * 60 * modifier;
    } else {
        let minutes = parseInt(timeLimit.trim());
        if (isNaN(minutes)) {
            console.error("Unknown time limit format", timeLimit);
            return 0;
        }
        return minutes * 60 * modifier;
    }
}

export class AssignmentInterface {
    server: Server;
    courseId: number;
    user: User;
    assignmentGroupId: number;
    isInstructor: ko.Observable<boolean>;

    currentAssignmentId: ko.Observable<number>;
    assignment: ko.Observable<Assignment>;
    submission: ko.Observable<Submission>;
    markCorrect: (id: number) => void;

    timeChecker: NodeJS.Timeout | null;

    constructor(params: AssignmentInterfaceJson) {
        this.server = params.server;
        this.courseId = params.courseId;
        this.user = params.user;
        this.currentAssignmentId = params.currentAssignmentId;
        this.assignmentGroupId = params.assignmentGroupId;
        if (typeof params.isInstructor === "boolean") {
            this.isInstructor = ko.observable(params.isInstructor);
        } else {
            this.isInstructor = params.isInstructor;
        }
        this.assignment = ko.observable(null);
        this.submission = ko.observable(null);
        this.markCorrect = params.markCorrect;

        let BlockPyServer = window["$MAIN_BLOCKPY_EDITOR"].components.server;
        BlockPyServer.altLogEntry = this.logEvent.bind(this);

        if (window["$TIME_CHECKER_ID"]) {
            clearInterval(window["$TIME_CHECKER_ID"]);
            console.log("Killing old time checker", window["$TIME_CHECKER_ID"]);
        }
        this.timeChecker = setInterval(() => {
            try {
                this.handleTimeCheck();
            } catch (e) {
                console.error("Failed to handle time check", e);
                this.logEvent(
                    "timer_error",
                    "timer",
                    "time_error",
                    JSON.stringify({
                        error: e.toString(),
                        stack: e.stack,
                    }),
                    this.assignment() ? this.assignment().url() : "",
                    () => {}
                );
                $(".assignment-selector-countdown").html("Error with timer");
            }
        }, 5000);
        window["$TIME_CHECKER_ID"] = this.timeChecker;
    }

    handleTimeCheck() {
        // There can be only one time checker at a time on the page
        if (this.timeChecker !== window["$TIME_CHECKER_ID"]) {
            // If this is not the current time checker, then we stop
            if (this.timeChecker != null) {
                clearInterval(this.timeChecker);
                console.log("Killing old time checker", this.timeChecker);
                this.timeChecker = null;
                this.logEvent(
                    "timer_cleared",
                    "timer",
                    "time_clear",
                    "",
                    this.assignment().url(),
                    () => {}
                );
            }
            return;
        }
        // Otherwise, we might need to check the time
        if (this.assignment() != null && this.submission() != null) {
            let now = new Date();
            const rawSettings = this.assignment().settings();
            let settings;
            if (!rawSettings || rawSettings.trim() === "") {
                return;
            }
            try {
                settings = JSON.parse(rawSettings);
            } catch (e) {
                console.error(
                    "Failed to parse assignment settings",
                    rawSettings,
                    e
                );
                return;
            }
            if (!settings.time_limit) {
                return;
            }
            const timeLimit = parseTimeLimit(
                settings.time_limit,
                this.submission().timeLimit()
            );
            const startTime = this.submission().dateStarted();
            if (startTime) {
                const startDate = new Date(startTime);
                // console.log(startTime, startDate, now.getTime());
                const elapsed = Math.floor(
                    (now.getTime() - startDate.getTime()) / 1000
                );
                const remaining = timeLimit - elapsed;
                if (remaining <= 0) {
                    // Time is up, we should submit the assignment
                    // Check if overlay already exists
                    if ($(".end-assignment-timer-box").length > 0) {
                        // Overlay already exists, do not create a new one
                        return;
                    }
                    if (this.isInstructor()) {
                        return;
                    }
                    // TODO: We need to allow instructors to remove the box if it appears for them!
                    // Add a box in the center of the overlay that explains
                    const box = $(
                        '<div class="end-assignment-timer-box"> </div>'
                    );
                    box.appendTo(document.body);
                    box.html(
                        "Time is up! Your assignment will be automatically submitted now. You may not continue working on it. Please log out. Thanks for taking the exam, and best of luck!"
                    );
                    box.css({
                        position: "fixed",
                        width: "100%",
                        height: "100%",
                        top: "0",
                        left: 0,
                        padding: "20px",
                        "background-color": "white",
                        border: "1px solid black",
                        "border-radius": "10px",
                        "text-align": "center",
                        "z-index": "1000",
                    });
                    this.logEvent(
                        "timer_expired",
                        "timer",
                        "time_up",
                        JSON.stringify({
                            elapsed: elapsed,
                            remaining: remaining,
                            time_limit: timeLimit,
                            start_time: startTime,
                        }),
                        this.assignment().url(),
                        () => {}
                    );
                }

                $(".assignment-selector-countdown").html(
                    formatAmount(elapsed, " elapsed", true) +
                        "; " +
                        formatAmount(remaining, " left", true)
                );
                $(".assignment-selector-clock").hide();
            }
        }
    }

    logEvent(
        eventType: string,
        category: string,
        label: string,
        message: string,
        file_path: string,
        callback: any
    ) {
        let BlockPyServer = window["$MAIN_BLOCKPY_EDITOR"].components.server;
        let now = new Date();
        let data = {
            assignment_id: this.assignment().id,
            assignment_group_id: this.assignmentGroupId,
            course_id: this.courseId,
            submission_id: this.submission().id,
            user_id: this.user.id,
            version: this.assignment().version(),
            timestamp: now.getTime(),
            timezone: now.getTimezoneOffset(),
            passcode: window["$MAIN_BLOCKPY_EDITOR"].model.display.passcode(),
            event_type: eventType,
            category: category,
            label: label,
            file_path: file_path,
            message: message,
        };
        return BlockPyServer._postRetry(data, "logEvent", 0, callback);
    }

    saveFile(
        filename: string,
        contents: string,
        block: boolean,
        onSuccess: (response: any) => void,
        onError?: any
    ) {
        let BlockPyServer = window["$MAIN_BLOCKPY_EDITOR"].components.server;
        let now = new Date();
        let data = {
            assignment_id: this.assignment().id,
            assignment_group_id: this.assignmentGroupId,
            course_id: this.courseId,
            submission_id: this.submission().id,
            user_id: this.user.id,
            version: this.assignment().version(),
            timestamp: now.getTime(),
            timezone: now.getTimezoneOffset(),
            passcode: window["$MAIN_BLOCKPY_EDITOR"].model.display.passcode(),
            filename: filename,
            code: contents,
        };
        if (onError === undefined) {
            onError = (e: any, textStatus: string, errorThrown: any) => {
                console.error(
                    "Failed to load (HTTP LEVEL)",
                    e,
                    textStatus,
                    errorThrown
                );
            };
        }
        if (onSuccess == null) {
            onSuccess = (response: any) => response.success; // && console.log(response);
        }
        if (block) {
            return BlockPyServer._postBlocking(
                "saveFile",
                data,
                3,
                () => 0,
                onSuccess,
                onError
            );
        } else {
            return BlockPyServer._postLatestRetry(
                data,
                filename,
                "saveFile",
                300,
                onError,
                onSuccess
            );
        }
    }

    saveAssignmentSettings(settings: Record<string, any>) {
        let BlockPyServer = window["$MAIN_BLOCKPY_EDITOR"].components.server;
        let now = new Date();
        let data = {
            assignment_id: this.assignment().id,
            assignment_group_id: this.assignmentGroupId,
            course_id: this.courseId,
            submission_id: this.submission().id,
            user_id: this.user.id,
            version: this.assignment().version(),
            timestamp: now.getTime(),
            timezone: now.getTimezoneOffset(),
            passcode: window["$MAIN_BLOCKPY_EDITOR"].model.display.passcode(),
            ...settings,
        };
        /*
            // New Stuff
            hidden: this.assignment().hidden(),
            reviewed: this.assignment().reviewed(),
            'public': this.assignment().public(),
            url: this.assignment().url(),
            points: this.assignment().points(),
            ip_ranges: this.assignment().ipRanges(),
            'name': this.assignment().name(),
            settings: this.assignment().settings()
        };*/

        const onError = (e: any, textStatus: string, errorThrown: any) => {
            window[
                "$MAIN_BLOCKPY_EDITOR"
            ].components.dialog.ERROR_SAVING_ASSIGNMNENT();
            console.error(
                "Failed to load (HTTP LEVEL)",
                e,
                textStatus,
                errorThrown
            );
        };
        const onSuccess = (response: any) =>
            response.success && console.log(response);
        return BlockPyServer._postBlocking(
            "saveAssignment",
            data,
            3,
            () => 0,
            onSuccess,
            onError
        );
    }
}

export enum EditorMode {
    SUBMISSION = "SUBMISSION",
    RAW = "RAW",
    FORM = "FORM",
}
