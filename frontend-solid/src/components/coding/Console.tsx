/**
 * Console component for displaying stdout/stderr and REPL
 */

import { Component, createSignal, For, Show } from 'solid-js';
import { ExecutionResult, ReplState } from './types';

interface ConsoleProps {
    result: ExecutionResult | null;
    replState: ReplState;
    onReplSubmit: (code: string) => void;
    isReplActive: boolean;
}

export const Console: Component<ConsoleProps> = (props) => {
    const [input, setInput] = createSignal('');

    const handleSubmit = (e: Event) => {
        e.preventDefault();
        const code = input();
        if (code.trim()) {
            props.onReplSubmit(code);
            setInput('');
        }
    };

    return (
        <div class="console-container border rounded p-3" style="background-color: #1e1e1e; color: #d4d4d4; font-family: 'Consolas', 'Monaco', monospace; height: 100%; overflow-y: auto;">
            <h5 class="text-light mb-3">Console</h5>
            
            {/* Execution Output */}
            <Show when={props.result}>
                <div class="console-output mb-3">
                    <Show when={props.result!.stdout}>
                        <div class="stdout" style="color: #d4d4d4; white-space: pre-wrap;">
                            {props.result!.stdout}
                        </div>
                    </Show>
                    <Show when={props.result!.stderr}>
                        <div class="stderr" style="color: #f48771; white-space: pre-wrap;">
                            {props.result!.stderr}
                        </div>
                    </Show>
                    <Show when={props.result!.error}>
                        <div class="error" style="color: #f48771; white-space: pre-wrap;">
                            {props.result!.error}
                        </div>
                    </Show>
                </div>
            </Show>

            {/* REPL History */}
            <Show when={props.isReplActive}>
                <div class="repl-history mb-2">
                    <For each={props.replState.history}>
                        {(item) => (
                            <div class="repl-item mb-1" style="white-space: pre-wrap;">
                                {item}
                            </div>
                        )}
                    </For>
                </div>

                {/* REPL Input */}
                <form onSubmit={handleSubmit} class="repl-input">
                    <div class="input-group">
                        <span class="input-group-text" style="background-color: #2d2d2d; color: #4ec9b0; border-color: #3e3e3e;">
                            &gt;&gt;&gt;
                        </span>
                        <input
                            type="text"
                            class="form-control"
                            value={input()}
                            onInput={(e) => setInput(e.currentTarget.value)}
                            placeholder="Enter code..."
                            style="background-color: #2d2d2d; color: #d4d4d4; border-color: #3e3e3e;"
                        />
                        <button 
                            type="submit" 
                            class="btn btn-primary"
                            disabled={!input().trim()}
                        >
                            Execute
                        </button>
                    </div>
                </form>
            </Show>
        </div>
    );
};
