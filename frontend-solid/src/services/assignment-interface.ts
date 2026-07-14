/**
 * AssignmentInterface - Shared logic for assignment-based components
 * 
 * Provides common functionality for Quiz, Reader, and other assignment types:
 * - Time limit tracking and exam timer
 * - Event logging
 * - File saving
 * - Assignment settings management
 * - Assignment/submission loading
 */

import { createSignal, createEffect, onCleanup, Accessor, Setter } from 'solid-js';
import { Assignment } from '../models/assignment';
import { Submission } from '../models/submission';
import { User } from '../models/user';
import { ajax_post } from './ajax';

export interface AssignmentInterfaceConfig {
    courseId: number;
    assignmentGroupId: number;
    user: User;
    isInstructor: boolean;
    currentAssignmentId?: number;
    markCorrect?: (assignmentId: number) => void;
}

export interface TimeLimit {
    timeLimit: string;
    studentLimit: string | null;
}

/**
 * Parse time limit strings into seconds
 * Examples: "60min", "2x", "90"
 */
export function parseTimeLimit(timeLimit: string, studentLimit: string | null): number {
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
        const minutes = parseInt(timeLimit.replace("min", "").trim());
        return minutes * 60 * modifier;
    } else {
        const minutes = parseInt(timeLimit.trim());
        if (isNaN(minutes)) {
            console.error("Unknown time limit format", timeLimit);
            return 0;
        }
        return minutes * 60 * modifier;
    }
}

/**
 * Format elapsed/remaining time display
 */
export function formatAmount(seconds: number, suffix: string, showSeconds: boolean = true): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    let result = '';
    if (hours > 0) {
        result += `${hours}h `;
    }
    if (minutes > 0 || hours > 0) {
        result += `${minutes}m `;
    }
    if (showSeconds || (hours === 0 && minutes === 0)) {
        result += `${secs}s`;
    }
    
    return result.trim() + suffix;
}

export class AssignmentInterface {
    // Core configuration
    courseId: number;
    assignmentGroupId: number;
    user: User;
    markCorrect?: (assignmentId: number) => void;
    
    // Reactive state
    isInstructor: Accessor<boolean>;
    setIsInstructor: Setter<boolean>;
    assignment: Accessor<Assignment | null>;
    setAssignment: Setter<Assignment | null>;
    submission: Accessor<Submission | null>;
    setSubmission: Setter<Submission | null>;
    
    // Time checker
    private timeCheckerId: number | null = null;
    private static globalTimeCheckerId: number | null = null;
    
    constructor(config: AssignmentInterfaceConfig) {
        this.courseId = config.courseId;
        this.assignmentGroupId = config.assignmentGroupId;
        this.user = config.user;
        this.markCorrect = config.markCorrect;
        
        const [isInstructor, setIsInstructor] = createSignal(config.isInstructor);
        this.isInstructor = isInstructor;
        this.setIsInstructor = setIsInstructor;
        
        const [assignment, setAssignment] = createSignal<Assignment | null>(null);
        this.assignment = assignment;
        this.setAssignment = setAssignment;
        
        const [submission, setSubmission] = createSignal<Submission | null>(null);
        this.submission = submission;
        this.setSubmission = setSubmission;
        
        // Start time checker
        this.startTimeChecker();
        
        // Clean up on unmount
        onCleanup(() => this.dispose());
    }
    
    /**
     * Start the time checking interval for exam timers
     */
    private startTimeChecker() {
        // Clear any existing time checker
        if (AssignmentInterface.globalTimeCheckerId !== null) {
            clearInterval(AssignmentInterface.globalTimeCheckerId);
            console.log("Killing old time checker", AssignmentInterface.globalTimeCheckerId);
        }
        
        this.timeCheckerId = window.setInterval(() => {
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
                        stack: e instanceof Error ? e.stack : ''
                    }),
                    this.assignment()?.url() || "",
                    () => {}
                );
                const countdownEl = document.querySelector(".assignment-selector-countdown");
                if (countdownEl) {
                    countdownEl.innerHTML = "Error with timer";
                }
            }
        }, 5000);
        
        AssignmentInterface.globalTimeCheckerId = this.timeCheckerId;
    }
    
    /**
     * Handle time checking for exam timers
     */
    handleTimeCheck() {
        // Check if this is still the active time checker
        if (this.timeCheckerId !== AssignmentInterface.globalTimeCheckerId) {
            if (this.timeCheckerId !== null) {
                clearInterval(this.timeCheckerId);
                console.log("Killing old time checker", this.timeCheckerId);
                this.timeCheckerId = null;
                this.logEvent(
                    "timer_cleared",
                    "timer",
                    "time_clear",
                    "",
                    this.assignment()?.url() || "",
                    () => {}
                );
            }
            return;
        }
        
        const assignment = this.assignment();
        const submission = this.submission();
        
        if (!assignment || !submission) {
            return;
        }
        
        const now = new Date();
        const rawSettings = assignment.settings();
        
        if (!rawSettings || rawSettings.trim() === "") {
            return;
        }
        
        let settings: any;
        try {
            settings = JSON.parse(rawSettings);
        } catch (e) {
            console.error("Failed to parse assignment settings", rawSettings, e);
            return;
        }
        
        if (!settings.time_limit) {
            return;
        }
        
        const timeLimit = parseTimeLimit(settings.time_limit, submission.timeLimit());
        const startTime = submission.dateStarted();
        
        if (startTime) {
            const startDate = new Date(startTime);
            const elapsed = Math.floor((now.getTime() - startDate.getTime()) / 1000);
            const remaining = timeLimit - elapsed;
            
            if (remaining <= 0) {
                // Time is up
                const existingBox = document.querySelector('.end-assignment-timer-box');
                if (existingBox || this.isInstructor()) {
                    return;
                }
                
                // Create overlay
                const box = document.createElement('div');
                box.className = 'end-assignment-timer-box';
                box.innerHTML = "Time is up! Your assignment will be automatically submitted now. You may not continue working on it. Please log out. Thanks for taking the exam, and best of luck!";
                box.style.cssText = `
                    position: fixed;
                    width: 100%;
                    height: 100%;
                    top: 0;
                    left: 0;
                    padding: 20px;
                    background-color: white;
                    border: 1px solid black;
                    border-radius: 10px;
                    text-align: center;
                    z-index: 1000;
                `;
                document.body.appendChild(box);
                
                this.logEvent(
                    "timer_expired",
                    "timer",
                    "time_up",
                    JSON.stringify({
                        elapsed,
                        remaining,
                        time_limit: timeLimit,
                        start_time: startTime
                    }),
                    assignment.url(),
                    () => {}
                );
            }
            
            // Update countdown display
            const countdownEl = document.querySelector(".assignment-selector-countdown");
            if (countdownEl) {
                countdownEl.innerHTML = 
                    formatAmount(elapsed, " elapsed", true) + "; " +
                    formatAmount(remaining, " left", true);
            }
            
            const clockEl = document.querySelector(".assignment-selector-clock");
            if (clockEl) {
                (clockEl as HTMLElement).style.display = 'none';
            }
        }
    }
    
    /**
     * Log an event to the server
     */
    logEvent(
        eventType: string,
        category: string,
        label: string,
        message: string,
        filePath: string,
        callback: (response: any) => void
    ): Promise<any> {
        const assignment = this.assignment();
        const submission = this.submission();
        
        if (!assignment || !submission) {
            console.warn("Cannot log event without assignment/submission");
            return Promise.resolve({ success: false });
        }
        
        const now = new Date();
        const data = {
            assignment_id: assignment.id,
            assignment_group_id: this.assignmentGroupId,
            course_id: this.courseId,
            submission_id: submission.id,
            user_id: this.user.id,
            version: assignment.version(),
            timestamp: now.getTime(),
            timezone: now.getTimezoneOffset(),
            passcode: '', // TODO: Get from BlockPy editor if needed
            event_type: eventType,
            category,
            label,
            file_path: filePath,
            message
        };
        
        return ajax_post('blockpy/log_event/', data)
            .then((response) => {
                callback(response);
                return response;
            })
            .catch((error) => {
                console.error("Failed to log event", error);
                return { success: false, error };
            });
    }
    
    /**
     * Save a file to the server
     */
    saveFile(
        filename: string,
        contents: string,
        block: boolean,
        onSuccess?: (response: any) => void,
        onError?: (error: any) => void
    ): Promise<any> {
        const assignment = this.assignment();
        const submission = this.submission();
        
        if (!assignment || !submission) {
            console.warn("Cannot save file without assignment/submission");
            return Promise.resolve({ success: false });
        }
        
        const now = new Date();
        const data = {
            assignment_id: assignment.id,
            assignment_group_id: this.assignmentGroupId,
            course_id: this.courseId,
            submission_id: submission.id,
            user_id: this.user.id,
            version: assignment.version(),
            timestamp: now.getTime(),
            timezone: now.getTimezoneOffset(),
            passcode: '', // TODO: Get from BlockPy editor if needed
            filename,
            code: contents
        };
        
        return ajax_post('blockpy/save_file/', data)
            .then((response) => {
                if (onSuccess) {
                    onSuccess(response);
                }
                return response;
            })
            .catch((error) => {
                console.error("Failed to save file", error);
                if (onError) {
                    onError(error);
                }
                return { success: false, error };
            });
    }
    
    /**
     * Save assignment settings (instructor only)
     */
    saveAssignmentSettings(settings: Record<string, any>): Promise<any> {
        const assignment = this.assignment();
        const submission = this.submission();
        
        if (!assignment || !submission) {
            console.warn("Cannot save assignment settings without assignment/submission");
            return Promise.resolve({ success: false });
        }
        
        const now = new Date();
        const data = {
            assignment_id: assignment.id,
            assignment_group_id: this.assignmentGroupId,
            course_id: this.courseId,
            submission_id: submission.id,
            user_id: this.user.id,
            version: assignment.version(),
            timestamp: now.getTime(),
            timezone: now.getTimezoneOffset(),
            passcode: '', // TODO: Get from BlockPy editor if needed
            ...settings
        };
        
        return ajax_post('blockpy/save_assignment/', data)
            .then((response) => {
                console.log("Assignment saved", response);
                return response;
            })
            .catch((error) => {
                console.error("Failed to save assignment", error);
                alert("Error saving assignment. Please try again.");
                return { success: false, error };
            });
    }
    
    /**
     * Load an assignment and submission by ID
     */
    loadAssignment(assignmentId: number): Promise<{ assignment: Assignment; submission: Submission | null }> {
        if (!assignmentId) {
            this.setAssignment(null);
            this.setSubmission(null);
            return Promise.resolve({ assignment: null as any, submission: null });
        }
        
        const data = {
            assignment_id: assignmentId,
            course_id: this.courseId,
            user_id: this.user.id
        };
        
        return ajax_post('blockpy/load_assignment/', data)
            .then((response) => {
                if (response.success) {
                    const assignment = new Assignment(response.assignment);
                    const submission = response.submission ? new Submission(response.submission) : null;
                    
                    this.setAssignment(assignment);
                    this.setSubmission(submission);
                    
                    return { assignment, submission };
                } else {
                    console.error("Failed to load assignment", response);
                    this.setAssignment(null);
                    this.setSubmission(null);
                    throw new Error(response.message?.message || "Failed to load assignment");
                }
            })
            .catch((error) => {
                console.error("Failed to load assignment (HTTP level)", error);
                this.setAssignment(null);
                this.setSubmission(null);
                throw error;
            });
    }
    
    /**
     * Clean up resources
     */
    dispose() {
        if (this.timeCheckerId !== null) {
            clearInterval(this.timeCheckerId);
            this.timeCheckerId = null;
        }
        
        if (AssignmentInterface.globalTimeCheckerId === this.timeCheckerId) {
            AssignmentInterface.globalTimeCheckerId = null;
        }
    }
}

export enum EditorMode {
    SUBMISSION = "SUBMISSION",
    RAW = "RAW",
    FORM = "FORM"
}
