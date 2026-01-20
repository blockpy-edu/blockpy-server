/**
 * Feedback panel component for displaying instructor-generated feedback messages
 */

import { Component, For, Show } from 'solid-js';
import { FeedbackMessage } from './types';

interface FeedbackPanelProps {
    messages: FeedbackMessage[];
    onToggleTrace: () => void;
    onToggleConsoleStretch: () => void;
    isTraceMode: boolean;
    isConsoleStretched: boolean;
}

export const FeedbackPanel: Component<FeedbackPanelProps> = (props) => {
    const getPriorityColor = (priority?: string) => {
        switch (priority) {
            case 'high': return 'danger';
            case 'medium': return 'warning';
            case 'low': return 'info';
            default: return 'secondary';
        }
    };

    const renderMarkdown = (markdown: string) => {
        // Simple markdown rendering - in production, use a proper markdown library
        return { __html: markdown.replace(/\n/g, '<br>') };
    };

    return (
        <div class="feedback-panel border rounded p-3" style="height: 100%; overflow-y: auto;">
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h5 class="mb-0">Feedback</h5>
                <div class="btn-group btn-group-sm">
                    <button
                        class={`btn ${props.isTraceMode ? 'btn-primary' : 'btn-outline-primary'}`}
                        onClick={props.onToggleTrace}
                        title="Toggle Trace Mode"
                    >
                        <i class="bi bi-bug"></i> Trace
                    </button>
                    <button
                        class={`btn ${props.isConsoleStretched ? 'btn-primary' : 'btn-outline-primary'}`}
                        onClick={props.onToggleConsoleStretch}
                        title="Toggle Console Stretch"
                    >
                        <i class="bi bi-arrows-expand"></i> Stretch
                    </button>
                </div>
            </div>

            <Show when={props.messages.length === 0}>
                <div class="text-muted text-center py-4">
                    <i class="bi bi-chat-dots" style="font-size: 2rem;"></i>
                    <p>No feedback messages yet.</p>
                    <p class="small">Feedback will appear here after running your code.</p>
                </div>
            </Show>

            <For each={props.messages}>
                {(message) => (
                    <div class={`card mb-3 border-${getPriorityColor(message.priority)}`}>
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <strong>{message.title}</strong>
                            <span class={`badge bg-${getPriorityColor(message.priority)}`}>
                                {message.label}
                            </span>
                        </div>
                        <div class="card-body">
                            <p class="card-subtitle text-muted small mb-2">
                                Category: {message.category}
                            </p>
                            <div 
                                class="feedback-body"
                                innerHTML={renderMarkdown(message.body)}
                            />
                            <Show when={message.timestamp}>
                                <p class="card-text small text-muted mt-2">
                                    {new Date(message.timestamp!).toLocaleString()}
                                </p>
                            </Show>
                        </div>
                    </div>
                )}
            </For>
        </div>
    );
};
