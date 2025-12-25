/**
 * FileEditor component with tab management for code files and configuration
 */

import { Component, createSignal, For, Show } from 'solid-js';
import { EditorTab, Runtime, TabType } from './types';

interface FileEditorProps {
    tabs: EditorTab[];
    activeTabId: string;
    onTabChange: (tabId: string) => void;
    onContentChange: (tabId: string, content: string) => void;
    onAddFile: () => void;
    onCloseTab: (tabId: string) => void;
    isInstructor: boolean;
}

export const FileEditor: Component<FileEditorProps> = (props) => {
    const activeTab = () => props.tabs.find(t => t.id === props.activeTabId);

    const getTabIcon = (tab: EditorTab) => {
        switch (tab.type) {
            case 'file':
                return tab.language === 'python' ? 'bi-filetype-py' : 'bi-filetype-ts';
            case 'instructions':
                return 'bi-book';
            case 'autograding':
                return 'bi-check2-square';
            case 'initial':
                return 'bi-file-earmark-code';
            case 'settings':
                return 'bi-gear';
            default:
                return 'bi-file-earmark';
        }
    };

    const handleContentChange = (e: Event) => {
        const textarea = e.currentTarget as HTMLTextAreaElement;
        props.onContentChange(props.activeTabId, textarea.value);
    };

    return (
        <div class="file-editor">
            {/* Tabs */}
            <ul class="nav nav-tabs" role="tablist">
                <For each={props.tabs}>
                    {(tab) => (
                        <Show when={!tab.isConfig || props.isInstructor}>
                            <li class="nav-item" role="presentation">
                                <button
                                    class={`nav-link ${tab.id === props.activeTabId ? 'active' : ''}`}
                                    onClick={() => props.onTabChange(tab.id)}
                                    type="button"
                                    role="tab"
                                >
                                    <i class={`bi ${getTabIcon(tab)} me-1`}></i>
                                    {tab.label}
                                    <Show when={tab.type === 'file' && tab.id !== 'main'}>
                                        <button
                                            class="btn btn-sm btn-link p-0 ms-2"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                props.onCloseTab(tab.id);
                                            }}
                                            title="Close tab"
                                        >
                                            <i class="bi bi-x"></i>
                                        </button>
                                    </Show>
                                </button>
                            </li>
                        </Show>
                    )}
                </For>
                <Show when={props.isInstructor}>
                    <li class="nav-item">
                        <button
                            class="nav-link"
                            onClick={props.onAddFile}
                            title="Add new file"
                        >
                            <i class="bi bi-plus-circle"></i>
                        </button>
                    </li>
                </Show>
            </ul>

            {/* Editor Content */}
            <div class="tab-content border border-top-0 p-3" style="min-height: 400px;">
                <Show when={activeTab()}>
                    <div class="tab-pane fade show active">
                        <Show when={activeTab()!.isConfig}>
                            <div class="alert alert-info mb-3">
                                <i class="bi bi-info-circle me-2"></i>
                                <strong>Instructor Only:</strong> This configuration tab is only visible to instructors.
                            </div>
                        </Show>
                        
                        <textarea
                            class="form-control font-monospace"
                            style="min-height: 350px; font-size: 14px; background-color: #1e1e1e; color: #d4d4d4; border: none;"
                            value={activeTab()!.content || ''}
                            onInput={handleContentChange}
                            placeholder={`Enter ${activeTab()!.label} content...`}
                            spellcheck={false}
                        />
                        
                        <div class="mt-2 text-muted small">
                            <Show when={activeTab()!.language}>
                                <span class="badge bg-secondary me-2">
                                    {activeTab()!.language === 'python' ? 'Python' : 'TypeScript'}
                                </span>
                            </Show>
                            <span>
                                Lines: {(activeTab()!.content || '').split('\n').length} | 
                                Characters: {(activeTab()!.content || '').length}
                            </span>
                        </div>
                    </div>
                </Show>
            </div>
        </div>
    );
};
