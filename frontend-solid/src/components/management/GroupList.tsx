import { Component, createSignal, onMount, For, Show } from 'solid-js';
import type { AssignmentGroup } from '../../models/assignment';
import { ajax_get } from '../../services/ajax';

interface GroupListProps {
    courseId: number;
}

export const GroupList: Component<GroupListProps> = (props) => {
    const [groups, setGroups] = createSignal<AssignmentGroup[]>([]);
    const [isLoading, setIsLoading] = createSignal(true);
    const [error, setError] = createSignal<string | null>(null);

    const loadGroups = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const response = await ajax_get('get/', { course_id: props.courseId });
            if (response.groups) {
                setGroups(response.groups);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load groups');
        } finally {
            setIsLoading(false);
        }
    };

    onMount(() => {
        loadGroups();
    });

    return (
        <div class="group-list">
            <h3>Assignment Groups</h3>
            
            <Show when={isLoading()}>
                <div class="spinner-border" role="status">
                    <span class="sr-only">Loading groups...</span>
                </div>
            </Show>

            <Show when={error()}>
                <div class="alert alert-danger" role="alert">
                    {error()}
                </div>
            </Show>

            <Show when={!isLoading() && !error()}>
                <Show when={groups().length === 0}>
                    <p class="text-muted">No groups found.</p>
                </Show>

                <Show when={groups().length > 0}>
                    <ul class="list-group">
                        <For each={groups()}>
                            {(group: any) => (
                                <li class="list-group-item">
                                    <strong>{group.name}</strong>
                                    {group.url && <><br /><small class="text-muted">URL: {group.url}</small></>}
                                </li>
                            )}
                        </For>
                    </ul>
                </Show>
            </Show>
        </div>
    );
};
