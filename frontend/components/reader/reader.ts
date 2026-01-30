/***
 * ### Supporting BlockPy Inside of Readers ###
 * Add a new "part ID" to configuration settings in BlockPy, set when the instance is loaded.
 *     That narrows what is rendered in the area and what is saved in the whole thing
 * Load the plugin in Reader
 *     https://github.com/markdown-it/markdown-it-container
 *     Add a new set of tags for BlockPy regions (including the required Part ID)
 * On backend, need to handle the Part ID for saving/loading files, to only update part of the region of the file.
 *     Also needs to make "starting_code" work more intelligently - it should make it based on the file type
 */

import * as ko from 'knockout';
import {ajax_post} from "../../services/ajax";
import {Server} from "../../services/server";
import {User} from "../../models/user";
import {Assignment} from "../../models/assignment";
import {Submission} from "../../models/submission";
import {AssignmentInterface, AssignmentInterfaceJson, EditorMode} from "../assignment_interface";
import {STORAGE_SERVICE} from "../../utilities/safe_local_storage";
import READER_HTML from "./reader.html";
import EDITOR_HTML from "./editor.html";

// TODO: Prevent popout button in exams, allow easy to close button there too?
// TODO: Fix IP Change logEvent?
// TODO: Mark as success on load

export const LOG_TIME_RATE = 30000;
export const VIDEO_EVENTS = "pause playing seeked ended loadeddata error ratechange waiting";

interface ReaderInterfaceJson extends AssignmentInterfaceJson {
    asPreamble: boolean
}

export class Reader extends AssignmentInterface {
    logTimer: NodeJS.Timeout;
    logCount: number;
    oldPosition: number;
    startedPlayingAt: number;
    videoLogger: any;
    video: ko.Observable<string>;
    videoOptions: ko.Observable<Record<string, string>>;
    ytPlayer: any;
    youtube: ko.Observable<string>;
    youtubeOptions: ko.Observable<Record<string, string>>;
    header: ko.Observable<string>;
    slides: ko.Observable<string>;
    summary: ko.Observable<string>;
    startTimerButton: ko.Observable<boolean>;

    asPreamble: ko.Observable<boolean>;
    allowPopout: ko.Observable<boolean>;

    errorMessage: ko.Observable<string>;
    editorMode: ko.Observable<EditorMode>;

    LS_CURRENT_VOICE_CHOICES_KEY = "blockpy-reader-voice-choice";

    subscriptions: {
        currentAssignmentId: ko.Subscription,
        windowPositioning: (event: Event) => void,
        videoUrl: ko.Subscription
    }

    constructor(params: ReaderInterfaceJson) {
        super(params);
        this.subscriptions = {currentAssignmentId: null, windowPositioning: null, videoUrl: null};
        this.logCount = 0;
        this.oldPosition = null;
        this.startedPlayingAt = null;
        this.youtubeOptions = ko.observable<Record<string, string>>({});
        this.youtube = ko.observable<string>("");
        this.videoOptions = ko.observable<Record<string, string>>({});
        this.video = ko.observable<string>("");
        this.header = ko.observable<string>("");
        this.slides = ko.observable<string>("");
        this.summary = ko.observable<string>("");
        this.asPreamble = ko.observable<boolean>(params.asPreamble || false);
        this.allowPopout = ko.observable<boolean>(true);

        this.startTimerButton = ko.observable<boolean>(false);

        this.editorMode = ko.observable(EditorMode.SUBMISSION);
        this.errorMessage = ko.observable("");

        this.subscriptions.currentAssignmentId = this.currentAssignmentId.subscribe((newId) => {
            this.loadReading(newId);
        }, this);
        this.loadReading(this.currentAssignmentId());

        this.subscriptions.windowPositioning = this.getWindowPositioning.bind(this)
        window.addEventListener('message', this.subscriptions.windowPositioning);

        this.subscriptions.videoUrl = this.video.subscribe((newUrl) => {
            $(".reader-video-display").attr("src", newUrl + "#t=1");
            $(".reader-video-display track").attr("src", newUrl.slice(0, -3) + "vtt");
            /*<source data-bind="attr: { src: video() + '#t=1' }" type="video/mp4" >
            <track data-bind="attr: { src: video().slice(0, -3) + 'vtt'}"
                default kind="captions" srclang="en" label="English">*/
        });
    }

    hideExamMovementControls() {
        $(".assignment-selector-div").hide();
    }
    showExamMovementControls() {
        $(".assignment-selector-div").show();
    }

    startTimer() {
        const dateStarted = (new Date()).toISOString();
        return new Promise((resolve, reject) => {
            ajax_post("blockpy/start_assignment/", {
                assignment_id: this.assignment().id,
                assignment_group_id: this.assignmentGroupId,
                course_id: this.courseId,
                user_id: this.user.id,
                date_started: dateStarted,
            }).then((response) => {
                if (response.success) {
                    this.submission().dateStarted(dateStarted);
                    this.showExamMovementControls();
                    resolve(response);
                } else {
                    alert("The exam could not be started. Please try reloading the page and starting again.");

                    console.error("Failed to start timer", response);
                    reject(response);
                }
            }).catch((error) => {
                alert("The exam could not be started. Please try reloading the page and starting again.");
                console.error("Failed to start timer (HTTP LEVEL)", error);
                reject(error);
            })
        });
    }

    loadReading(assignmentId: number) {
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
                        this.logCount = 1;
                        this.logTimer = setTimeout(this.logReadingStart.bind(this), 1000);
                        this.assignment().instructions.subscribe(this.registerWatcher.bind(this));
                        this.parseAdditionalSettings();
                        if (response.submission) {
                            this.markRead();
                        }
                        this.registerWatcher();
                        this.handleTimeCheck();
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

    setVoice(voice: string, voiceUrl: string) {
        this.youtube(voiceUrl);
        this.rememberVoiceChoice(voice);
    }

    setVoiceVideo(voice: string, voiceUrl: string) {
        this.video(voiceUrl);
        this.rememberVoiceChoice(voice);
    }

    getBestVoice(options: Record<string, string>) {
        let previouslyChosenVoices = STORAGE_SERVICE.get(this.LS_CURRENT_VOICE_CHOICES_KEY);
        const defaultVoice = Object.values(options)[0] || "";
        if (previouslyChosenVoices == null) {
            return defaultVoice;
        }
        try {
            previouslyChosenVoices = JSON.parse(previouslyChosenVoices);
        } catch {
            return defaultVoice;
        }
        for (const voice of previouslyChosenVoices) {
            if (voice in options) {
                return options[voice];
            }
        }
        return defaultVoice;
    }

    rememberVoiceChoice(voice: string) {
        let previouslyChosenVoicesRaw = STORAGE_SERVICE.get(this.LS_CURRENT_VOICE_CHOICES_KEY);
        if (previouslyChosenVoicesRaw == null) {
            STORAGE_SERVICE.set(this.LS_CURRENT_VOICE_CHOICES_KEY, JSON.stringify([voice]));
            return;
        }
        let previouslyChosenVoices: string[];
        try {
            previouslyChosenVoices = JSON.parse(previouslyChosenVoicesRaw);
        } catch {
            STORAGE_SERVICE.set(this.LS_CURRENT_VOICE_CHOICES_KEY, JSON.stringify([voice]));
            return;
        }
        // Remove if it exists
        previouslyChosenVoices = previouslyChosenVoices.filter(v => v !== voice);
        // Add it to the front
        previouslyChosenVoices.unshift(voice);
        // Store it for next time
        STORAGE_SERVICE.set(this.LS_CURRENT_VOICE_CHOICES_KEY, JSON.stringify(previouslyChosenVoices));
    }

    parseAdditionalSettings() {
        let settingsRaw = this.assignment().settings();
        let settings = JSON.parse(settingsRaw || "{}");
        if (settings.youtube instanceof Object) {
            this.youtubeOptions(settings.youtube);
            this.youtube(this.getBestVoice(settings.youtube));
        } else {
            this.youtubeOptions({});
            this.youtube(settings.youtube || "");
        }
        if (settings.video instanceof Object) {
            this.videoOptions(settings.video);
            this.video(this.getBestVoice(settings.video));
        } else {
            this.videoOptions({});
            this.video(settings.video || "");
        }
        console.log(settings);
        if ('popout' in settings) {
            this.allowPopout(settings.popout);
        }
        this.header(settings.header || "");
        let slides = settings.slides || "";
        if (slides && !(/^https?:\/\//.test(slides))) {
            slides = window["$URL_ROOT"] + `blockpy/download_file?placement=assignment&directory=${this.assignment().id}&filename=${slides}`;
        }
        this.slides(slides);
        this.summary(settings.summary || "");
        this.startTimerButton(settings.start_timer_button || false);
        if (this.startTimerButton()) {
            if (!this.isInstructor() && this.submission() && !this.submission().dateStarted()) {
                this.hideExamMovementControls();
            }
        }
    }

    logWatching(event: any) {
        if (this.assignment()) {
            if (this.video().length) {
                const duration = event.type === "pause" ? event.currentTarget.currentTime - (this.startedPlayingAt || 0): 0;
                this.logEvent("Resource.View", "reading", "watch",
                    JSON.stringify({
                        "event": event.type,
                        "time": event.currentTarget.currentTime,
                        "duration": duration,
                    }), this.assignment().url(), () => {});
                if (event.type === "playing") {
                    this.startedPlayingAt = event.currentTarget.currentTime;
                }
            } else if (this.youtube()) {
                this.logEvent("Resource.View", "reading", "watch",
                    JSON.stringify({
                        "event": event.data,
                        "time": this.ytPlayer.getCurrentTime()
                    }), this.assignment().url(), () => {})
            }
        }
    }



    dispose() {
        super.dispose();
        this.subscriptions.currentAssignmentId.dispose();
        window.removeEventListener('message', this.subscriptions.windowPositioning);
        if (this.ytPlayer) {
            //this.ytPlayer.stopVideo();
            this.ytPlayer.destroy();
            this.ytPlayer = null;
        }
        if (this.videoLogger) {
            this.videoLogger.off(VIDEO_EVENTS);
        }
    }

    registerWatcher() {
        if (this.youtube() && !this.video()) {
            this.registerYoutubeWatcher();
        } else {
            this.registerVideoWatcher();
        }
    }

    registerVideoWatcher() {
        this.videoLogger = $(".reader-video-display");
        this.videoLogger.on(VIDEO_EVENTS, this.logWatching.bind(this));
    }

    registerYoutubeWatcher() {
        //let youtubes = $("iframe[src^='https://www.youtube.com']");
        // XTODO: Map it over any youtube videos
        //let url = youtubes.attr("src");
        //let id = url.replace(/.*\/(\w+)\/?.*$/, '$1');
        //youtubes.attr("id", id);

        try {
            // @ts-ignore
            this.ytPlayer = new YT.Player('reader-youtube-video', {
                // TODO: log 'onPlaybackRateChange'
                playerVars: {
                    origin: window["$URL_ROOT"],
                    enablejsapi: 1,
                },
                events: {
                    'onStateChange': this.logWatching.bind(this)
                }
            })
        } catch (error) {
            console.log("YT Player probably not available.");
            console.error(error);
        }
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

// TODO: Pop out button to put into another frame
// TODO: Log all youtube and scrolling

const FULL_HTML = `
<div data-bind="if: assignment">
    ${EDITOR_HTML}
    ${READER_HTML}
</div>
`

ko.components.register("reader", {
    viewModel: Reader,
    template: FULL_HTML
});
