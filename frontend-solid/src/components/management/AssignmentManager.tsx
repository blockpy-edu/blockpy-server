import { Component, createSignal, onMount, For, Show } from 'solid-js';
import type { Assignment } from '../../models/assignment';
import type { User } from '../../models/user';
import { ajax_post } from '../../services/ajax';

export enum AssignmentType {
    BLOCKPY = 'BlockPy',
    READING = 'Reading',
    QUIZ = 'quiz',
    TYPESCRIPT = 'TypeScript',
    TEXTBOOK = 'Textbook',
    EXPLAIN = 'explain',
    MAZE = 'Maze'
}

interface AssignmentGroup {
    id: number;
    name: string;
    url: string;
}

interface AssignmentManagerProps {
    courseId: number;
    user: User;
}

export const AssignmentManager: Component<AssignmentManagerProps> = (props) => {
    const [assignments, setAssignments] = createSignal<Assignment[]>([]);
    const [groups, setGroups] = createSignal<AssignmentGroup[]>([]);
    const [isLoading, setIsLoading] = createSignal(true);
    
    // Create Assignment Modal
    const [showCreateAssignment, setShowCreateAssignment] = createSignal(false);
    const [createAssignmentType, setCreateAssignmentType] = createSignal<AssignmentType>(AssignmentType.BLOCKPY);
    const [createAssignmentName, setCreateAssignmentName] = createSignal('');
    const [createAssignmentUrl, setCreateAssignmentUrl] = createSignal('');
    const [createAssignmentLevel, setCreateAssignmentLevel] = createSignal('1');
    
    // Create Group Modal
    const [showCreateGroup, setShowCreateGroup] = createSignal(false);
    const [createGroupName, setCreateGroupName] = createSignal('');
    const [createGroupUrl, setCreateGroupUrl] = createSignal('');

    const loadAssignments = async () => {
        try {
            setIsLoading(true);
            // In real implementation, this would call the actual API
            const response = await ajax_post('assignments/get_all', {
                course_id: props.courseId,
                assignment_ids: ''
            });
            if (response.assignments) {
                setAssignments(response.assignments);
            }
            if (response.groups) {
                setGroups(response.groups);
            }
        } catch (error) {
            console.error('Failed to load assignments:', error);
        } finally {
            setIsLoading(false);
        }
    };

    onMount(() => {
        loadAssignments();
    });

    const addAssignment = async () => {
        try {
            const data: any = {
                course_id: props.courseId,
                type: createAssignmentType(),
                name: createAssignmentName(),
                url: createAssignmentUrl()
            };

            if (createAssignmentType() === AssignmentType.MAZE) {
                data.level = createAssignmentLevel();
            }

            const response = await ajax_post('assignments/create', data);
            
            if (response.success) {
                await loadAssignments();
                setShowCreateAssignment(false);
                resetCreateAssignmentForm();
            } else {
                alert('Failed to create assignment: ' + response.message);
            }
        } catch (error) {
            console.error('Failed to create assignment:', error);
            alert('Failed to create assignment');
        }
    };

    const addGroup = async () => {
        try {
            const response = await ajax_post('assignment_groups/create', {
                course_id: props.courseId,
                name: createGroupName(),
                url: createGroupUrl()
            });
            
            if (response.success) {
                await loadAssignments();
                setShowCreateGroup(false);
                resetCreateGroupForm();
            } else {
                alert('Failed to create group: ' + response.message);
            }
        } catch (error) {
            console.error('Failed to create group:', error);
            alert('Failed to create group');
        }
    };

    const moveMembership = async (assignment: Assignment, group: AssignmentGroup) => {
        try {
            const response = await ajax_post('assignments/move_group', {
                assignment_id: assignment.id,
                group_id: group.id
            });
            
            if (response.success) {
                await loadAssignments();
            } else {
                alert('Failed to move assignment: ' + response.message);
            }
        } catch (error) {
            console.error('Failed to move assignment:', error);
            alert('Failed to move assignment');
        }
    };

    const removeAssignment = async (assignment: Assignment) => {
        if (!confirm(`Are you sure you want to delete "${assignment.title()}"?`)) {
            return;
        }
        
        try {
            const response = await ajax_post('assignments/delete', {
                assignment_id: assignment.id
            });
            
            if (response.success) {
                await loadAssignments();
            } else {
                alert('Failed to delete assignment: ' + response.message);
            }
        } catch (error) {
            console.error('Failed to delete assignment:', error);
            alert('Failed to delete assignment');
        }
    };

    const resetCreateAssignmentForm = () => {
        setCreateAssignmentType(AssignmentType.BLOCKPY);
        setCreateAssignmentName('');
        setCreateAssignmentUrl('');
        setCreateAssignmentLevel('1');
    };

    const resetCreateGroupForm = () => {
        setCreateGroupName('');
        setCreateGroupUrl('');
    };

    return (
        <div class="assignment-manager">
            <h3>Assignment Manager</h3>

            {/* Action Buttons */}
            <div class="mb-3">
                <button
                    class="btn btn-outline-secondary btn-sm mr-2"
                    onClick={() => setShowCreateAssignment(true)}
                >
                    Create Assignment <span class="fas fa-plus"></span>
                </button>
                <button
                    class="btn btn-outline-secondary btn-sm mr-2"
                    onClick={() => setShowCreateGroup(true)}
                >
                    Create Group <span class="fas fa-folder-plus"></span>
                </button>
                <button class="btn btn-outline-secondary btn-sm mr-2" disabled>
                    Import from another course <span class="fas fa-file-import"></span>
                </button>
                <button class="btn btn-outline-secondary btn-sm" disabled>
                    Import from file <span class="fas fa-file-upload"></span>
                </button>
            </div>

            {/* Assignments Table */}
            <Show when={isLoading()}>
                <div class="spinner-border" role="status">
                    <span class="sr-only">Loading assignments...</span>
                </div>
            </Show>

            <Show when={!isLoading()}>
                <table class="table table-condensed table-hover">
                    <caption>Assignments</caption>
                    <thead>
                        <tr>
                            <th style="width: 25%">Details</th>
                            <th style="width: 42%">Instructions</th>
                            <th style="width: 16%">Group</th>
                            <th style="width: 17%">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <For each={assignments()}>
                            {(assignment) => (
                                <tr class="hover-movers-rows">
                                    <td>
                                        <strong>{assignment.title()}</strong><br />
                                        <span class="small">{assignment.url()}</span><br />
                                        <span>{assignment.prettyDateModified?.()}</span>
                                    </td>
                                    <td>
                                        <span>{assignment.instructions?.() || 'No instructions'}</span>
                                    </td>
                                    <td>
                                        <div class="btn-group">
                                            <button
                                                type="button"
                                                class="btn btn-outline-secondary btn-sm dropdown-toggle"
                                                data-toggle="dropdown"
                                            >
                                                Move Group <span class="caret"></span>
                                            </button>
                                            <div class="dropdown-menu dropdown-menu-right">
                                                <For each={groups()}>
                                                    {(group) => (
                                                        <a
                                                            href="#"
                                                            class="dropdown-item"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                moveMembership(assignment, group);
                                                            }}
                                                        >
                                                            {group.name}
                                                        </a>
                                                    )}
                                                </For>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <div class="btn-group">
                                            <a
                                                href={assignment.editUrl?.()}
                                                target="_blank"
                                                class="btn btn-primary btn-sm"
                                            >
                                                Edit
                                            </a>
                                            <button
                                                type="button"
                                                class="btn btn-primary dropdown-toggle btn-sm"
                                                data-toggle="dropdown"
                                            >
                                                <span class="caret"></span>
                                            </button>
                                            <div class="dropdown-menu">
                                                <a
                                                    class="dropdown-item"
                                                    href="#"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        removeAssignment(assignment);
                                                    }}
                                                >
                                                    Delete
                                                </a>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </For>
                    </tbody>
                </table>

                <Show when={assignments().length === 0}>
                    <p class="text-muted">No assignments found.</p>
                </Show>
            </Show>

            {/* Create Assignment Modal */}
            <Show when={showCreateAssignment()}>
                <div class="modal fade show d-block" tabIndex={-1}>
                    <div class="modal-dialog">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h4 class="modal-title">Create Assignment</h4>
                                <button
                                    type="button"
                                    class="close"
                                    onClick={() => setShowCreateAssignment(false)}
                                >
                                    <span>&times;</span>
                                </button>
                            </div>
                            <div class="modal-body">
                                <div class="form-group">
                                    <label>Type:</label>
                                    <select
                                        class="form-control"
                                        value={createAssignmentType()}
                                        onChange={(e) =>
                                            setCreateAssignmentType(e.target.value as AssignmentType)
                                        }
                                    >
                                        <option value={AssignmentType.BLOCKPY}>BlockPy</option>
                                        <option value={AssignmentType.READING}>Reading</option>
                                        <option value={AssignmentType.QUIZ}>Quiz Questions</option>
                                        <option value={AssignmentType.TYPESCRIPT}>TypeScript</option>
                                        <option value={AssignmentType.TEXTBOOK}>Textbook</option>
                                        <option value={AssignmentType.EXPLAIN}>Code Explanation</option>
                                        <option value={AssignmentType.MAZE}>Maze</option>
                                    </select>
                                </div>
                                <Show when={createAssignmentType() !== AssignmentType.MAZE}>
                                    <div class="form-group">
                                        <label>Student-facing Name:</label>
                                        <input
                                            type="text"
                                            class="form-control"
                                            value={createAssignmentName()}
                                            onInput={(e) => setCreateAssignmentName(e.target.value)}
                                            placeholder="Day 1 - #1.1"
                                        />
                                    </div>
                                    <div class="form-group">
                                        <label>Unique Internal URL:</label>
                                        <input
                                            type="text"
                                            class="form-control"
                                            value={createAssignmentUrl()}
                                            onInput={(e) => setCreateAssignmentUrl(e.target.value)}
                                            placeholder="assignment_url"
                                        />
                                    </div>
                                </Show>
                                <Show when={createAssignmentType() === AssignmentType.MAZE}>
                                    <div class="form-group">
                                        <label>Maze Level:</label>
                                        <select
                                            class="form-control"
                                            value={createAssignmentLevel()}
                                            onChange={(e) => setCreateAssignmentLevel(e.target.value)}
                                        >
                                            {Array.from({ length: 10 }, (_, i) => i + 1).map(level => (
                                                <option value={level}>Level {level}</option>
                                            ))}
                                        </select>
                                    </div>
                                </Show>
                            </div>
                            <div class="modal-footer">
                                <button
                                    type="button"
                                    class="btn btn-outline-secondary"
                                    onClick={() => setShowCreateAssignment(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    class="btn btn-primary"
                                    onClick={addAssignment}
                                >
                                    Create
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-backdrop fade show"></div>
            </Show>

            {/* Create Group Modal */}
            <Show when={showCreateGroup()}>
                <div class="modal fade show d-block" tabIndex={-1}>
                    <div class="modal-dialog">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h4 class="modal-title">Create Assignment Group</h4>
                                <button
                                    type="button"
                                    class="close"
                                    onClick={() => setShowCreateGroup(false)}
                                >
                                    <span>&times;</span>
                                </button>
                            </div>
                            <div class="modal-body">
                                <div class="form-group">
                                    <label>Name:</label>
                                    <input
                                        type="text"
                                        class="form-control"
                                        value={createGroupName()}
                                        onInput={(e) => setCreateGroupName(e.target.value)}
                                        placeholder="Day X -"
                                    />
                                </div>
                                <div class="form-group">
                                    <label>Internal Unique Url:</label>
                                    <input
                                        type="text"
                                        class="form-control"
                                        value={createGroupUrl()}
                                        onInput={(e) => setCreateGroupUrl(e.target.value)}
                                        placeholder="unique_group"
                                    />
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button
                                    type="button"
                                    class="btn btn-outline-secondary"
                                    onClick={() => setShowCreateGroup(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    class="btn btn-primary"
                                    onClick={addGroup}
                                >
                                    Create
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-backdrop fade show"></div>
            </Show>
        </div>
    );
};
