/**
 * TraceViewer component with VCR controls for stepping through execution
 */

import { Component, Show, For } from 'solid-js';
import { ExecutionTrace, VariableState } from './types';

interface TraceViewerProps {
    trace: ExecutionTrace | null;
    onStepChange: (step: number) => void;
}

export const TraceViewer: Component<TraceViewerProps> = (props) => {
    const currentStep = () => props.trace?.currentStep ?? 0;
    const totalSteps = () => props.trace?.steps.length ?? 0;
    const step = () => props.trace?.steps[currentStep()];

    const canGoBack = () => currentStep() > 0;
    const canGoForward = () => currentStep() < totalSteps() - 1;

    const handleFirst = () => props.onStepChange(0);
    const handlePrevious = () => canGoBack() && props.onStepChange(currentStep() - 1);
    const handleNext = () => canGoForward() && props.onStepChange(currentStep() + 1);
    const handleLast = () => props.onStepChange(totalSteps() - 1);
    const handleStepBack = () => canGoBack() && props.onStepChange(Math.max(0, currentStep() - 5));
    const handleStepForward = () => canGoForward() && props.onStepChange(Math.min(totalSteps() - 1, currentStep() + 5));

    return (
        <div class="trace-viewer border rounded p-3">
            <Show when={!props.trace || totalSteps() === 0}>
                <div class="text-muted text-center py-4">
                    <i class="bi bi-arrow-repeat" style="font-size: 2rem;"></i>
                    <p>No trace data available.</p>
                    <p class="small">Run your code to generate an execution trace.</p>
                </div>
            </Show>

            <Show when={props.trace && totalSteps() > 0}>
                <div class="trace-controls mb-3">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <h5 class="mb-0">Execution Trace</h5>
                        <span class="badge bg-info">
                            Step {currentStep() + 1} of {totalSteps()}
                        </span>
                    </div>

                    {/* VCR Controls */}
                    <div class="btn-toolbar justify-content-center mb-3" role="toolbar">
                        <div class="btn-group me-2" role="group">
                            <button
                                class="btn btn-outline-secondary"
                                onClick={handleFirst}
                                disabled={!canGoBack()}
                                title="First Step"
                            >
                                <i class="bi bi-skip-start-fill"></i>
                            </button>
                            <button
                                class="btn btn-outline-secondary"
                                onClick={handleStepBack}
                                disabled={!canGoBack()}
                                title="Step Back 5"
                            >
                                <i class="bi bi-skip-backward-fill"></i>
                            </button>
                            <button
                                class="btn btn-outline-secondary"
                                onClick={handlePrevious}
                                disabled={!canGoBack()}
                                title="Previous Step"
                            >
                                <i class="bi bi-caret-left-fill"></i>
                            </button>
                        </div>
                        <div class="btn-group" role="group">
                            <button
                                class="btn btn-outline-secondary"
                                onClick={handleNext}
                                disabled={!canGoForward()}
                                title="Next Step"
                            >
                                <i class="bi bi-caret-right-fill"></i>
                            </button>
                            <button
                                class="btn btn-outline-secondary"
                                onClick={handleStepForward}
                                disabled={!canGoForward()}
                                title="Step Forward 5"
                            >
                                <i class="bi bi-skip-forward-fill"></i>
                            </button>
                            <button
                                class="btn btn-outline-secondary"
                                onClick={handleLast}
                                disabled={!canGoForward()}
                                title="Last Step"
                            >
                                <i class="bi bi-skip-end-fill"></i>
                            </button>
                        </div>
                    </div>

                    {/* Current Step Info */}
                    <Show when={step()}>
                        <div class="current-step mb-3">
                            <div class="alert alert-info mb-2">
                                <strong>File:</strong> {step()!.file} &nbsp;|&nbsp; <strong>Line:</strong> {step()!.line}
                            </div>
                            <Show when={step()!.stdout}>
                                <div class="alert alert-secondary mb-2">
                                    <strong>Output:</strong> <code>{step()!.stdout}</code>
                                </div>
                            </Show>
                        </div>

                        {/* Variable State Table */}
                        <div class="variable-state">
                            <h6>Variables</h6>
                            <Show when={step()!.variables.length === 0}>
                                <p class="text-muted small">No variables at this step.</p>
                            </Show>
                            <Show when={step()!.variables.length > 0}>
                                <div class="table-responsive">
                                    <table class="table table-sm table-bordered">
                                        <thead class="table-light">
                                            <tr>
                                                <th>Name</th>
                                                <th>Type</th>
                                                <th>Value</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <For each={step()!.variables}>
                                                {(variable: VariableState) => (
                                                    <tr>
                                                        <td><code>{variable.name}</code></td>
                                                        <td><span class="badge bg-secondary">{variable.type}</span></td>
                                                        <td><code>{variable.value}</code></td>
                                                    </tr>
                                                )}
                                            </For>
                                        </tbody>
                                    </table>
                                </div>
                            </Show>
                        </div>
                    </Show>
                </div>
            </Show>
        </div>
    );
};
