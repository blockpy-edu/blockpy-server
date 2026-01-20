/**
 * Main CodingAssignment component
 * Handles both Python and TypeScript code editing and execution
 */

import { Component, createSignal, createEffect, Show, onCleanup } from 'solid-js';
import { Console } from './Console';
import { FeedbackPanel } from './FeedbackPanel';
import { TraceViewer } from './TraceViewer';
import { FileEditor } from './FileEditor';
import {
    CodingAssignmentData,
    ExecutionResult,
    FeedbackMessage,
    ReplState,
    ConsoleMode,
    ViewMode,
    EditorTab,
    ExecutionTrace
} from './types';
import { AssignmentInterface } from '../../services/assignment-interface';
import { User } from '../../models/user';

interface CodingAssignmentProps {
    assignment: CodingAssignmentData;
    user: User;
    courseId: number;
    isInstructor: boolean;
}

export const CodingAssignment: Component<CodingAssignmentProps> = (props) => {
    // State management
    const [viewMode, setViewMode] = createSignal<ViewMode>(props.isInstructor ? 'instructor' : 'student');
    const [consoleMode, setConsoleMode] = createSignal<ConsoleMode>('split');
    const [executionResult, setExecutionResult] = createSignal<ExecutionResult | null>(null);
    const [feedbackMessages, setFeedbackMessages] = createSignal<FeedbackMessage[]>([]);
    const [replState, setReplState] = createSignal<ReplState>({ history: [], currentInput: '' });
    const [isReplActive, setIsReplActive] = createSignal(false);
    const [executionTrace, setExecutionTrace] = createSignal<ExecutionTrace | null>(null);
    const [tabs, setTabs] = createSignal<EditorTab[]>([]);
    const [activeTabId, setActiveTabId] = createSignal('main');
    const [isFullscreen, setIsFullscreen] = createSignal(false);
    const [isRunning, setIsRunning] = createSignal(false);

    // Assignment Interface for common functionality
    const assignmentInterface = new AssignmentInterface({
        courseId: props.courseId,
        assignmentGroupId: props.assignment.id,
        user: props.user,
        isInstructor: props.isInstructor
    });

    // Initialize tabs
    createEffect(() => {
        const mainFile = props.assignment.mainFile;
        const runtime = props.assignment.runtime;
        
        const initialTabs: EditorTab[] = [
            {
                id: 'main',
                label: mainFile,
                type: 'file',
                content: props.assignment.submission?.files[mainFile] || props.assignment.initialCode || '',
                language: runtime
            }
        ];

        // Add other file tabs
        props.assignment.files.forEach(file => {
            if (file.name !== mainFile) {
                initialTabs.push({
                    id: file.name,
                    label: file.name,
                    type: 'file',
                    content: props.assignment.submission?.files[file.name] || file.content,
                    language: file.language
                });
            }
        });

        // Add instructor config tabs
        if (props.isInstructor) {
            initialTabs.push(
                {
                    id: 'instructions',
                    label: 'Instructions',
                    type: 'instructions',
                    content: props.assignment.instructions,
                    isConfig: true
                },
                {
                    id: 'autograding',
                    label: 'Autograding',
                    type: 'autograding',
                    content: props.assignment.autograde || '',
                    language: runtime,
                    isConfig: true
                },
                {
                    id: 'initial',
                    label: 'Initial Code',
                    type: 'initial',
                    content: props.assignment.initialCode || '',
                    language: runtime,
                    isConfig: true
                },
                {
                    id: 'settings',
                    label: 'Settings',
                    type: 'settings',
                    content: JSON.stringify(props.assignment.settings || {}, null, 2),
                    isConfig: true
                }
            );
        }

        setTabs(initialTabs);
    });

    // Load submission feedback if available
    createEffect(() => {
        if (props.assignment.submission?.feedback) {
            setFeedbackMessages(props.assignment.submission.feedback);
        }
    });

    // Handle code execution
    const handleRun = async () => {
        setIsRunning(true);
        setIsReplActive(false);
        
        try {
            // Collect all file contents
            const files: Record<string, string> = {};
            tabs().forEach(tab => {
                if (tab.type === 'file') {
                    files[tab.id] = tab.content || '';
                }
            });

            // Log the run event
            assignmentInterface.logEvent('Run.Program', 'coding', 'run', {
                runtime: props.assignment.runtime,
                files: Object.keys(files)
            });

            // Call backend to execute code
            const response = await fetch('/api/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    runtime: props.assignment.runtime,
                    files,
                    mainFile: props.assignment.mainFile,
                    autograde: props.assignment.autograde
                })
            });

            const result: ExecutionResult = await response.json();
            setExecutionResult(result);
            
            // Enable REPL if execution was successful
            if (result.success) {
                setIsReplActive(true);
            }

            // Set trace if available
            if (result.trace) {
                setExecutionTrace(result.trace);
            }

            // Generate feedback messages from result
            if (!result.success && result.error) {
                setFeedbackMessages([{
                    title: 'Execution Error',
                    category: 'Error',
                    label: 'Runtime Error',
                    body: result.error,
                    priority: 'high',
                    timestamp: Date.now()
                }]);
            }
        } catch (error) {
            console.error('Execution error:', error);
            setExecutionResult({
                stdout: '',
                stderr: '',
                error: 'Failed to execute code. Please try again.',
                success: false
            });
        } finally {
            setIsRunning(false);
        }
    };

    // Handle REPL submission
    const handleReplSubmit = async (code: string) => {
        const newHistory = [...replState().history, `>>> ${code}`];
        
        try {
            // Execute REPL code
            const response = await fetch('/api/execute/repl', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    runtime: props.assignment.runtime,
                    code,
                    context: executionResult()
                })
            });

            const result = await response.json();
            if (result.output) {
                newHistory.push(result.output);
            }
        } catch (error) {
            newHistory.push(`Error: ${error}`);
        }

        setReplState({ history: newHistory, currentInput: '' });
    };

    // Handle tab content changes
    const handleContentChange = (tabId: string, content: string) => {
        setTabs(tabs().map(tab => 
            tab.id === tabId ? { ...tab, content } : tab
        ));
    };

    // Handle adding new file
    const handleAddFile = () => {
        const fileName = prompt('Enter file name:');
        if (fileName) {
            const extension = fileName.split('.').pop();
            const language = extension === 'py' ? 'python' : extension === 'ts' ? 'typescript' : props.assignment.runtime;
            
            setTabs([...tabs(), {
                id: fileName,
                label: fileName,
                type: 'file',
                content: '',
                language
            }]);
            setActiveTabId(fileName);
        }
    };

    // Handle closing tab
    const handleCloseTab = (tabId: string) => {
        if (tabId === 'main') return; // Cannot close main file
        
        setTabs(tabs().filter(tab => tab.id !== tabId));
        if (activeTabId() === tabId) {
            setActiveTabId('main');
        }
    };

    // Handle trace step change
    const handleTraceStepChange = (step: number) => {
        const trace = executionTrace();
        if (trace) {
            setExecutionTrace({ ...trace, currentStep: step });
        }
    };

    // Toggle fullscreen
    const handleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    // Handle share link
    const handleShareLink = () => {
        const url = `${window.location.origin}/assignment/${props.assignment.id}`;
        navigator.clipboard.writeText(url);
        alert('Link copied to clipboard!');
    };

    // Cleanup
    onCleanup(() => {
        assignmentInterface.cleanup();
    });

    // Render markdown
    const renderMarkdown = (markdown: string) => {
        return { __html: markdown.replace(/\n/g, '<br>') };
    };

    return (
        <div class="coding-assignment" style={isFullscreen() ? 'padding: 20px;' : ''}>
            {/* Top Section */}
            <div class="top-section mb-3">
                <div class="row align-items-start">
                    {/* Left: Assignment Name and Description */}
                    <div class="col-md-8">
                        <h3>{props.assignment.name}</h3>
                        <div 
                            class="assignment-description p-3 border rounded bg-light"
                            innerHTML={renderMarkdown(props.assignment.instructions)}
                        />
                    </div>

                    {/* Right: Controls */}
                    <div class="col-md-4">
                        <div class="d-grid gap-2">
                            <Show when={props.isInstructor}>
                                <div class="btn-group" role="group">
                                    <button
                                        class={`btn ${viewMode() === 'instructor' ? 'btn-primary' : 'btn-outline-primary'}`}
                                        onClick={() => setViewMode('instructor')}
                                    >
                                        Instructor
                                    </button>
                                    <button
                                        class={`btn ${viewMode() === 'student' ? 'btn-primary' : 'btn-outline-primary'}`}
                                        onClick={() => setViewMode('student')}
                                    >
                                        Student
                                    </button>
                                </div>
                            </Show>

                            <button class="btn btn-success" onClick={handleRun} disabled={isRunning()}>
                                <i class="bi bi-play-fill me-2"></i>
                                {isRunning() ? 'Running...' : 'Run Code'}
                            </button>

                            <div class="btn-group" role="group">
                                <button 
                                    class="btn btn-outline-secondary btn-sm" 
                                    onClick={handleFullscreen}
                                    title="Toggle Fullscreen"
                                >
                                    <i class="bi bi-fullscreen"></i>
                                </button>
                                <button 
                                    class="btn btn-outline-secondary btn-sm"
                                    title="Edit Reusable Inputs"
                                >
                                    <i class="bi bi-input-cursor-text"></i>
                                </button>
                                <button 
                                    class="btn btn-outline-secondary btn-sm"
                                    onClick={handleShareLink}
                                    title="Get Shareable Link"
                                >
                                    <i class="bi bi-share"></i>
                                </button>
                                <Show when={props.isInstructor}>
                                    <button 
                                        class="btn btn-outline-secondary btn-sm"
                                        title="View Instructor Stdout"
                                    >
                                        <i class="bi bi-terminal"></i>
                                    </button>
                                    <button 
                                        class="btn btn-outline-secondary btn-sm"
                                        title="Edit Seed"
                                    >
                                        <i class="bi bi-shuffle"></i>
                                    </button>
                                </Show>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Middle Section: Console/Feedback/Trace */}
            <div class="middle-section mb-3">
                <Show when={consoleMode() === 'trace'}>
                    <TraceViewer 
                        trace={executionTrace()}
                        onStepChange={handleTraceStepChange}
                    />
                </Show>

                <Show when={consoleMode() === 'stretch'}>
                    <Console
                        result={executionResult()}
                        replState={replState()}
                        onReplSubmit={handleReplSubmit}
                        isReplActive={isReplActive()}
                    />
                </Show>

                <Show when={consoleMode() === 'split'}>
                    <div class="row">
                        <div class="col-md-6">
                            <Console
                                result={executionResult()}
                                replState={replState()}
                                onReplSubmit={handleReplSubmit}
                                isReplActive={isReplActive()}
                            />
                        </div>
                        <div class="col-md-6">
                            <FeedbackPanel
                                messages={feedbackMessages()}
                                onToggleTrace={() => setConsoleMode(consoleMode() === 'trace' ? 'split' : 'trace')}
                                onToggleConsoleStretch={() => setConsoleMode(consoleMode() === 'stretch' ? 'split' : 'stretch')}
                                isTraceMode={consoleMode() === 'trace'}
                                isConsoleStretched={consoleMode() === 'stretch'}
                            />
                        </div>
                    </div>
                </Show>
            </div>

            {/* Bottom Section: File Editor */}
            <div class="bottom-section">
                <FileEditor
                    tabs={tabs()}
                    activeTabId={activeTabId()}
                    onTabChange={setActiveTabId}
                    onContentChange={handleContentChange}
                    onAddFile={handleAddFile}
                    onCloseTab={handleCloseTab}
                    isInstructor={props.isInstructor}
                />
            </div>
        </div>
    );
};
