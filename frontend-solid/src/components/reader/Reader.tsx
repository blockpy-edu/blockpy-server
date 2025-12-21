import { createSignal, createEffect, onCleanup, Show, For } from 'solid-js';
import { Assignment } from '../../models/assignment';
import { Submission } from '../../models/submission';
import { User } from '../../models/user';
import { ajax_post } from '../../services/ajax';

export interface ReaderProps {
    courseId: number;
    assignmentGroupId?: number;
    currentAssignmentId: number;
    isInstructor: boolean;
    asPreamble?: boolean;
    user: User;
    onMarkCorrect?: (assignmentId: number) => void;
}

export enum EditorMode {
    RAW = 'RAW',
    FORM = 'FORM',
    SUBMISSION = 'SUBMISSION'
}

interface VideoOptions {
    [key: string]: string;
}

export function Reader(props: ReaderProps) {
    const [assignment, setAssignment] = createSignal<Assignment | null>(null);
    const [submission, setSubmission] = createSignal<Submission | null>(null);
    const [editorMode, setEditorMode] = createSignal<EditorMode>(EditorMode.SUBMISSION);
    const [errorMessage, setErrorMessage] = createSignal<string>('');
    
    // Video/YouTube state
    const [video, setVideo] = createSignal<string>('');
    const [videoOptions, setVideoOptions] = createSignal<VideoOptions>({});
    const [youtube, setYoutube] = createSignal<string>('');
    const [youtubeOptions, setYoutubeOptions] = createSignal<VideoOptions>({});
    
    // Content settings
    const [header, setHeader] = createSignal<string>('');
    const [slides, setSlides] = createSignal<string>('');
    const [summary, setSummary] = createSignal<string>('');
    const [allowPopout, setAllowPopout] = createSignal<boolean>(true);
    const [startTimerButton, setStartTimerButton] = createSignal<boolean>(false);
    
    // Logging
    let logTimer: NodeJS.Timeout | null = null;
    let logCount = 0;
    let ytPlayer: any = null;

    // Load reading when assignment ID changes
    createEffect(() => {
        const assignmentId = props.currentAssignmentId;
        if (assignmentId) {
            loadReading(assignmentId);
        }
    });

    function loadReading(assignmentId: number) {
        if (!assignmentId) {
            setAssignment(null);
            return;
        }

        ajax_post('/blockpy/load_assignment', {
            assignment_id: assignmentId,
            assignment_group_id: props.assignmentGroupId,
            course_id: props.courseId,
            user_id: props.user.id()
        }).then((response: any) => {
            if (response.success) {
                setAssignment(new Assignment(response.assignment));
                setSubmission(response.submission ? new Submission(response.submission) : null);
                parseAdditionalSettings(response.assignment.settings);
                
                if (response.submission) {
                    markRead();
                }
                
                logCount = 1;
                logTimer = setTimeout(() => logReadingStart(), 1000);
            } else {
                console.error('Failed to load', response);
                setAssignment(null);
            }
        }).catch((error: any) => {
            console.error('Failed to load (HTTP LEVEL)', error);
            setAssignment(null);
        });
    }

    function parseAdditionalSettings(settingsRaw: string) {
        const settings = JSON.parse(settingsRaw || '{}');
        
        // YouTube settings
        if (typeof settings.youtube === 'object' && settings.youtube !== null) {
            setYoutubeOptions(settings.youtube);
            setYoutube(getBestVoice(settings.youtube));
        } else {
            setYoutubeOptions({});
            setYoutube(settings.youtube || '');
        }
        
        // Video settings
        if (typeof settings.video === 'object' && settings.video !== null) {
            setVideoOptions(settings.video);
            setVideo(getBestVoice(settings.video));
        } else {
            setVideoOptions({});
            setVideo(settings.video || '');
        }
        
        setHeader(settings.header || '');
        setSlides(settings.slides || '');
        setSummary(settings.summary || '');
        setAllowPopout(settings.popout !== false);
        setStartTimerButton(settings.start_timer_button || false);
    }

    function getBestVoice(options: VideoOptions): string {
        const defaultVoice = Object.values(options)[0] || '';
        // TODO: Implement localStorage-based voice preference
        return defaultVoice;
    }

    function setVoice(voice: string, voiceUrl: string) {
        setYoutube(voiceUrl);
        // TODO: Remember voice choice in localStorage
    }

    function setVoiceVideo(voice: string, voiceUrl: string) {
        setVideo(voiceUrl);
        // TODO: Remember voice choice in localStorage
    }

    function logReadingStart() {
        // Log reading activity
        logCount += 1;
        if (assignment() && submission()) {
            logEvent('Resource.View', 'reading', 'read', JSON.stringify({
                count: logCount,
                timestamp: new Date().toISOString()
            }));
            
            const delay = logCount * 30000; // 30 seconds
            logTimer = setTimeout(() => logReadingStart(), delay);
        }
    }

    function logEvent(category: string, label: string, action: string, message: string) {
        const assign = assignment();
        if (!assign) return;
        
        ajax_post('/blockpy/log_event', {
            assignment_id: assign.id,
            assignment_group_id: props.assignmentGroupId,
            course_id: props.courseId,
            user_id: props.user.id(),
            category,
            label,
            action,
            message
        }).catch((error: any) => {
            console.error('Failed to log event', error);
        });
    }

    function markRead() {
        const assign = assignment();
        const sub = submission();
        if (!assign || !sub) return;

        ajax_post('/blockpy/update_submission', {
            assignment_id: assign.id,
            assignment_group_id: props.assignmentGroupId,
            course_id: props.courseId,
            submission_id: sub.id,
            user_id: props.user.id(),
            status: 1,
            correct: true,
            timestamp: new Date().getTime(),
            timezone: new Date().getTimezoneOffset()
        }).then((response: any) => {
            if (response.success) {
                sub.submissionStatus(response.submission_status);
                sub.correct(response.correct);
                if (response.correct && props.onMarkCorrect) {
                    props.onMarkCorrect(assign.id);
                }
            } else {
                console.error('Failed to mark read', response);
                setErrorMessage(response.message?.message || 'Failed to mark as read');
            }
        }).catch((error: any) => {
            console.error('Failed to mark read (HTTP LEVEL)', error);
            setErrorMessage('HTTP ERROR: ' + error.message);
        });
    }

    function startTimer() {
        const assign = assignment();
        if (!assign) return;

        const dateStarted = new Date().toISOString();
        ajax_post('/blockpy/start_assignment', {
            assignment_id: assign.id,
            assignment_group_id: props.assignmentGroupId,
            course_id: props.courseId,
            user_id: props.user.id(),
            date_started: dateStarted
        }).then((response: any) => {
            if (response.success) {
                const sub = submission();
                if (sub) {
                    sub.dateStarted(dateStarted);
                }
            } else {
                alert('The exam could not be started. Please try reloading the page and starting again.');
                console.error('Failed to start timer', response);
            }
        }).catch((error: any) => {
            alert('The exam could not be started. Please try reloading the page and starting again.');
            console.error('Failed to start timer (HTTP LEVEL)', error);
        });
    }

    function saveAssignment() {
        const assign = assignment();
        if (!assign) return;

        // Save assignment settings
        ajax_post('/blockpy/save_assignment', {
            assignment_id: assign.id,
            course_id: props.courseId,
            settings: assign.settings(),
            points: assign.points(),
            url: assign.url(),
            name: assign.name(),
            instructions: assign.instructions()
        }).then((response: any) => {
            if (response.success) {
                alert('Assignment saved successfully!');
            } else {
                console.error('Failed to save', response);
                alert('Failed to save assignment: ' + (response.message?.message || 'Unknown error'));
            }
        }).catch((error: any) => {
            console.error('Failed to save (HTTP LEVEL)', error);
            alert('HTTP ERROR: ' + error.message);
        });
    }

    // Cleanup
    onCleanup(() => {
        if (logTimer) {
            clearTimeout(logTimer);
        }
        if (ytPlayer) {
            ytPlayer.destroy();
            ytPlayer = null;
        }
    });

    return (
        <Show when={assignment()}>
            <div class="reader-container">
                {/* Error message */}
                <Show when={errorMessage()}>
                    <div class="alert alert-warning p-1 border rounded float-right m-3">
                        {errorMessage()}
                    </div>
                </Show>

                {/* Instructor Editor Mode */}
                <Show when={props.isInstructor && !props.asPreamble}>
                    <div class="btn-group-toggle mt-2 mb-2">
                        <label 
                            class="btn btn-outline-secondary mr-4"
                            classList={{ active: editorMode() === EditorMode.RAW }}
                        >
                            <input
                                type="radio"
                                name="reader-editor-mode"
                                checked={editorMode() === EditorMode.RAW}
                                onChange={() => setEditorMode(EditorMode.RAW)}
                            />
                            Raw Editor
                        </label>
                        <label 
                            class="btn btn-outline-secondary mr-4"
                            classList={{ active: editorMode() === EditorMode.FORM }}
                        >
                            <input
                                type="radio"
                                name="reader-editor-mode"
                                checked={editorMode() === EditorMode.FORM}
                                onChange={() => setEditorMode(EditorMode.FORM)}
                            />
                            Form Editor
                        </label>
                        <label 
                            class="btn btn-outline-secondary"
                            classList={{ active: editorMode() === EditorMode.SUBMISSION }}
                        >
                            <input
                                type="radio"
                                name="reader-editor-mode"
                                checked={editorMode() === EditorMode.SUBMISSION}
                                onChange={() => setEditorMode(EditorMode.SUBMISSION)}
                            />
                            Actual Reader
                        </label>
                    </div>
                    <hr />

                    {/* Raw Editor */}
                    <Show when={editorMode() === EditorMode.RAW}>
                        <button class="btn btn-primary" onClick={saveAssignment}>
                            Save Assignment
                        </button>
                        <br />
                        <h6>Instructions</h6>
                        <textarea
                            class="form-control"
                            style="width: 100%; height: 300px"
                            value={assignment()?.instructions()}
                            onInput={(e) => assignment()?.instructions(e.currentTarget.value)}
                        />
                        <br />
                        <h6>Settings</h6>
                        <textarea
                            class="form-control"
                            style="width: 100%; height: 300px"
                            value={assignment()?.settings()}
                            onInput={(e) => assignment()?.settings(e.currentTarget.value)}
                        />
                    </Show>

                    {/* Form Editor */}
                    <Show when={editorMode() === EditorMode.FORM}>
                        <button class="btn btn-primary mb-3" onClick={saveAssignment}>
                            Save Assignment
                        </button>
                        <br />
                        <div class="form-group">
                            <label>Instructions (Body)</label>
                            <textarea
                                class="form-control"
                                style="width: 100%; height: 500px"
                                value={assignment()?.instructions()}
                                onInput={(e) => assignment()?.instructions(e.currentTarget.value)}
                            />
                        </div>
                        <div class="form-group">
                            <label>Points</label>
                            <input
                                type="number"
                                class="form-control"
                                value={assignment()?.points()}
                                onInput={(e) => assignment()?.points(parseInt(e.currentTarget.value) || 0)}
                            />
                        </div>
                        <div class="form-group">
                            <label>Name</label>
                            <input
                                type="text"
                                class="form-control"
                                value={assignment()?.name()}
                                onInput={(e) => assignment()?.name(e.currentTarget.value)}
                            />
                        </div>
                        <div class="form-group">
                            <label>URL</label>
                            <input
                                type="text"
                                class="form-control"
                                value={assignment()?.url()}
                                onInput={(e) => assignment()?.url(e.currentTarget.value)}
                            />
                        </div>
                    </Show>
                </Show>

                {/* Actual Reader Content */}
                <Show when={editorMode() === EditorMode.SUBMISSION || !props.isInstructor}>
                    <div class="reader-content">
                        {/* Popout button */}
                        <Show when={allowPopout()}>
                            <a
                                href={assignment()?.editUrl() + '&embed=true'}
                                class="btn btn-sm btn-outline-secondary float-right m-3"
                                target="_blank"
                            >
                                <span class="fas fa-external-link-alt" /> Popout
                            </a>
                        </Show>

                        {/* Download button */}
                        <Show when={slides()}>
                            <a
                                href={slides()}
                                class="btn btn-sm btn-outline-secondary float-right m-3"
                                target="_blank"
                            >
                                <span class="fas fa-download" /> Download
                            </a>
                        </Show>

                        {/* Body */}
                        <div style="background: #FBFAF7" class="pt-4">
                            <Show when={header()}>
                                <h3 class="p-1">{header()}</h3>
                            </Show>
                            <Show when={summary()}>
                                <div class="p-1">{summary()}</div>
                            </Show>

                            {/* Voice selection for YouTube */}
                            <Show when={youtube() && !video() && Object.keys(youtubeOptions()).length > 1}>
                                <div style="float: right" class="btn-group" role="group">
                                    <button
                                        type="button"
                                        class="btn btn-outline-secondary dropdown-toggle"
                                        data-toggle="dropdown"
                                    >
                                        Voice
                                    </button>
                                    <div class="dropdown-menu">
                                        <For each={Object.keys(youtubeOptions())}>
                                            {(voice) => (
                                                <a
                                                    href="#"
                                                    class="dropdown-item"
                                                    classList={{ active: youtubeOptions()[voice] === youtube() }}
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        setVoice(voice, youtubeOptions()[voice]);
                                                    }}
                                                >
                                                    {voice}
                                                </a>
                                            )}
                                        </For>
                                    </div>
                                </div>
                            </Show>

                            {/* Voice selection for Video */}
                            <Show when={video() && Object.keys(videoOptions()).length > 1}>
                                <div style="float: right" class="btn-group" role="group">
                                    <button
                                        type="button"
                                        class="btn btn-outline-secondary dropdown-toggle"
                                        data-toggle="dropdown"
                                    >
                                        Voice
                                    </button>
                                    <div class="dropdown-menu">
                                        <For each={Object.keys(videoOptions())}>
                                            {(voice) => (
                                                <a
                                                    href="#"
                                                    class="dropdown-item"
                                                    classList={{ active: videoOptions()[voice] === video() }}
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        setVoiceVideo(voice, videoOptions()[voice]);
                                                    }}
                                                >
                                                    {voice}
                                                </a>
                                            )}
                                        </For>
                                    </div>
                                </div>
                            </Show>

                            {/* Video player */}
                            <Show when={video()}>
                                <video
                                    controls
                                    width="640"
                                    height="480"
                                    style="display: block; margin-left: auto; margin-right: auto;"
                                    crossorigin="anonymous"
                                    preload="metadata"
                                    class="reader-video-display"
                                >
                                    <source src={video() + '#t=1'} type="video/mp4" />
                                    <track
                                        src={video().slice(0, -3) + 'vtt'}
                                        default
                                        kind="captions"
                                        srclang="en"
                                        label="English"
                                    />
                                </video>
                            </Show>

                            {/* YouTube player */}
                            <Show when={youtube() && !video()}>
                                <iframe
                                    style="width: 640px; height: 480px; margin-left: 10%"
                                    width="300"
                                    height="150"
                                    allowfullscreen
                                    id="reader-youtube-video"
                                    title={assignment()?.name()}
                                    src={`https://www.youtube.com/embed/${youtube()}?feature=oembed&rel=0&enablejsapi=1`}
                                />
                            </Show>

                            {/* Instructions (markdown rendered) */}
                            <div
                                class="p-4"
                                innerHTML={assignment()?.instructions() || ''}
                            />

                            {/* Start timer button for exams */}
                            <Show when={startTimerButton()}>
                                <div class="text-center mb-4">
                                    <Show when={submission() && submission()!.dateStarted()}>
                                        <button class="btn btn-primary btn-lg" disabled>
                                            Exam has begun, please continue working.
                                        </button>
                                    </Show>
                                    <Show when={submission() && !submission()!.dateStarted()}>
                                        <button class="btn btn-primary btn-lg" onClick={startTimer}>
                                            I am ready to start the exam!
                                        </button>
                                    </Show>
                                </div>
                            </Show>

                            <hr />
                        </div>
                    </div>
                </Show>
            </div>
        </Show>
    );
}
