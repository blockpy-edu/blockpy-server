/**
 * Types for the Coding assignment component
 */

export type Runtime = 'python' | 'typescript';

export type ViewMode = 'student' | 'instructor';

export type ConsoleMode = 'split' | 'stretch' | 'trace';

export interface FeedbackMessage {
    title: string;
    category: string;
    label: string;
    body: string; // Markdown content
    priority?: 'low' | 'medium' | 'high';
    timestamp?: number;
}

export interface ExecutionResult {
    stdout: string;
    stderr: string;
    error?: string;
    success: boolean;
    trace?: ExecutionTrace;
}

export interface ExecutionTrace {
    steps: TraceStep[];
    currentStep: number;
}

export interface TraceStep {
    line: number;
    file: string;
    variables: VariableState[];
    stdout?: string;
}

export interface VariableState {
    name: string;
    type: string;
    value: string;
}

export interface CodeFile {
    name: string;
    content: string;
    language: Runtime;
    readOnly?: boolean;
}

export interface CodingAssignmentData {
    id: number;
    name: string;
    instructions: string; // Markdown
    runtime: Runtime;
    files: CodeFile[];
    mainFile: string; // e.g., 'main.py' or 'main.ts'
    autograde?: string; // Autograding code
    initialCode?: string;
    settings?: AssignmentSettings;
    submission?: StudentSubmission;
}

export interface AssignmentSettings {
    timeLimit?: string;
    allowedAttempts?: number;
    enableTrace?: boolean;
    enableRepl?: boolean;
    hiddenTests?: boolean;
}

export interface StudentSubmission {
    files: Record<string, string>; // filename -> content
    timestamp: number;
    score?: number;
    feedback?: FeedbackMessage[];
}

export interface ReplState {
    history: string[];
    currentInput: string;
}

export type TabType = 'file' | 'instructions' | 'autograding' | 'initial' | 'settings';

export interface EditorTab {
    id: string;
    label: string;
    type: TabType;
    content?: string;
    language?: Runtime;
    isConfig?: boolean; // True for instructor-only tabs
}
