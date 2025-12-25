import { Component, createSignal, createMemo, For, Show, onMount } from 'solid-js';

export enum SelectMode {
    ALL = 'ALL',
    SINGLE = 'SINGLE',
    SET = 'SET'
}

export interface ModelSet {
    name: string;
    ids: number[];
    default: boolean;
}

export interface Model {
    id: number;
    title: () => string;
}

interface ModelSelectorProps<T extends Model> {
    models: T[];
    label: string;
    onSelectionChange?: (ids: number[]) => void;
    defaultMode?: SelectMode;
    storageKey?: string;
}

export function ModelSelector<T extends Model>(props: ModelSelectorProps<T>): Component {
    return () => {
        const [selectMode, setSelectMode] = createSignal<SelectMode>(
            props.defaultMode || SelectMode.ALL
        );
        const [singleOption, setSingleOption] = createSignal<number | null>(null);
        const [currentSet, setCurrentSet] = createSignal<ModelSet>({
            name: `All ${props.label}s`,
            default: true,
            ids: props.models.map(m => m.id)
        });
        const [sets, setSets] = createSignal<ModelSet[]>([currentSet()]);
        const [editorVisible, setEditorVisible] = createSignal(false);
        const [selectedOptions, setSelectedOptions] = createSignal<number[]>([]);
        const [showAll, setShowAll] = createSignal(false);

        const showAllThreshold = 7;

        // Load from local storage
        onMount(() => {
            if (props.storageKey) {
                const stored = localStorage.getItem(props.storageKey);
                if (stored) {
                    try {
                        const parsedSets = JSON.parse(stored);
                        setSets(parsedSets);
                        if (parsedSets.length > 0) {
                            setCurrentSet(parsedSets[0]);
                        }
                    } catch (e) {
                        console.error('Failed to parse stored sets', e);
                    }
                }
            }
        });

        const selectedIds = createMemo(() => {
            switch (selectMode()) {
                case SelectMode.ALL:
                    return props.models.map(m => m.id);
                case SelectMode.SINGLE:
                    const id = singleOption();
                    return id !== null ? [id] : [];
                case SelectMode.SET:
                    return currentSet().ids;
                default:
                    return [];
            }
        });

        const prettyResult = createMemo(() => {
            const ids = selectedIds();
            const displayIds = showAll() ? ids : ids.slice(0, showAllThreshold);
            return displayIds.map(id => props.models.find(m => m.id === id)).filter(Boolean) as T[];
        });

        const startEditing = () => {
            setEditorVisible(true);
            setSelectedOptions(currentSet().ids);
        };

        const startAdding = () => {
            const newSet: ModelSet = {
                name: `New ${props.label} set`,
                default: false,
                ids: []
            };
            setSets([...sets(), newSet]);
            setCurrentSet(newSet);
            setEditorVisible(true);
            setSelectedOptions([]);
        };

        const saveSet = () => {
            const updated = {
                ...currentSet(),
                ids: selectedOptions()
            };
            setCurrentSet(updated);
            
            const updatedSets = sets().map(s =>
                s.name === updated.name && !s.default ? updated : s
            );
            setSets(updatedSets);
            
            if (props.storageKey) {
                localStorage.setItem(props.storageKey, JSON.stringify(updatedSets));
            }
            
            setEditorVisible(false);
            props.onSelectionChange?.(selectedOptions());
        };

        const deleteSet = () => {
            if (currentSet().default) {
                setEditorVisible(false);
                return false;
            }
            if (confirm('Are you sure you want to delete this set?')) {
                setSets(sets().filter(s => s !== currentSet()));
                setCurrentSet(sets()[0]);
                setEditorVisible(false);
                return true;
            }
            return false;
        };

        const cancelEdit = () => {
            setEditorVisible(false);
        };

        return (
            <div class="model-selector">
                {/* Mode Select */}
                <div class="form-check form-check-inline">
                    <input
                        class="form-check-input"
                        type="radio"
                        name={`${props.label}-mode`}
                        id={`${props.label}-all`}
                        value={SelectMode.ALL}
                        checked={selectMode() === SelectMode.ALL}
                        onChange={() => setSelectMode(SelectMode.ALL)}
                    />
                    <label class="form-check-label" for={`${props.label}-all`}>
                        All
                    </label>
                </div>
                <div class="form-check form-check-inline">
                    <input
                        class="form-check-input"
                        type="radio"
                        name={`${props.label}-mode`}
                        id={`${props.label}-single`}
                        value={SelectMode.SINGLE}
                        checked={selectMode() === SelectMode.SINGLE}
                        onChange={() => setSelectMode(SelectMode.SINGLE)}
                    />
                    <label class="form-check-label" for={`${props.label}-single`}>
                        Only
                    </label>
                </div>
                <div class="form-check form-check-inline">
                    <input
                        class="form-check-input"
                        type="radio"
                        name={`${props.label}-mode`}
                        id={`${props.label}-set`}
                        value={SelectMode.SET}
                        checked={selectMode() === SelectMode.SET}
                        onChange={() => setSelectMode(SelectMode.SET)}
                    />
                    <label class="form-check-label" for={`${props.label}-set`}>
                        {props.label} set
                    </label>
                </div>

                {/* Single Select */}
                <Show when={selectMode() === SelectMode.SINGLE}>
                    <select
                        class="form-control custom-select ml-2 custom-select-sm d-inline-block w-auto"
                        value={singleOption() || ''}
                        onChange={(e) => setSingleOption(parseInt(e.target.value, 10))}
                    >
                        <option value="">Select one...</option>
                        <For each={props.models}>
                            {(model) => <option value={model.id}>{model.title()}</option>}
                        </For>
                    </select>
                </Show>

                {/* Set Select */}
                <Show when={selectMode() === SelectMode.SET}>
                    <div class="form-inline mt-2">
                        <label class="mr-2">Show {props.label} set:</label>
                        <select
                            class="form-control custom-select ml-2 custom-select-sm"
                            value={currentSet().name}
                            onChange={(e) => {
                                const selected = sets().find(s => s.name === e.target.value);
                                if (selected) setCurrentSet(selected);
                            }}
                        >
                            <For each={sets()}>
                                {(set) => <option value={set.name}>{set.name}</option>}
                            </For>
                        </select>
                        <Show when={!editorVisible()}>
                            <button
                                type="button"
                                class="btn btn-sm btn-outline-secondary ml-2"
                                onClick={startEditing}
                            >
                                <span class="fas fa-edit"></span> Edit this {props.label} set
                            </button>
                            <button
                                type="button"
                                class="btn btn-sm btn-outline-secondary ml-2"
                                onClick={startAdding}
                            >
                                <span class="fas fa-plus"></span> Add new {props.label} set
                            </button>
                        </Show>
                    </div>

                    <Show when={editorVisible()}>
                        <div class="mt-3">
                            <label>
                                Current {props.label} set name:
                                <input
                                    type="text"
                                    class="form-control"
                                    value={currentSet().name}
                                    disabled={currentSet().default}
                                    onChange={(e) => {
                                        const updated = { ...currentSet(), name: e.target.value };
                                        setCurrentSet(updated);
                                    }}
                                />
                            </label>
                            <br />
                            <select
                                multiple
                                style={{ width: '100%', height: '200px' }}
                                class="form-control"
                                onChange={(e) => {
                                    const selected = Array.from(e.target.selectedOptions).map(o =>
                                        parseInt(o.value, 10)
                                    );
                                    setSelectedOptions(selected);
                                }}
                            >
                                <For each={props.models}>
                                    {(model) => (
                                        <option
                                            value={model.id}
                                            selected={selectedOptions().includes(model.id)}
                                        >
                                            {model.title()}
                                        </option>
                                    )}
                                </For>
                            </select>
                            <div class="mt-2">
                                <button
                                    type="button"
                                    class="btn btn-success btn-sm"
                                    onClick={saveSet}
                                >
                                    Save {props.label} set
                                </button>
                                <button
                                    type="button"
                                    class="btn btn-outline-secondary btn-sm ml-4"
                                    onClick={cancelEdit}
                                >
                                    Cancel changes
                                </button>
                                <button
                                    type="button"
                                    class="btn btn-danger btn-sm float-right"
                                    onClick={deleteSet}
                                >
                                    Delete current {props.label} set
                                </button>
                            </div>
                        </div>
                    </Show>
                </Show>

                {/* Display selected items */}
                <Show when={!editorVisible()}>
                    <div class="mt-2">
                        Included {props.label}(s):
                        <For each={prettyResult()}>
                            {(model) => <span> {model.title()}, </span>}
                        </For>
                        <Show when={selectedIds().length > showAllThreshold}>
                            <button
                                type="button"
                                class="btn btn-primary btn-sm"
                                onClick={() => setShowAll(!showAll())}
                            >
                                <Show when={showAll()} fallback={
                                    <>
                                        Show more{' '}
                                        <span class="badge badge-light">
                                            {selectedIds().length - showAllThreshold}
                                        </span>
                                    </>
                                }>
                                    Hide all
                                </Show>
                            </button>
                        </Show>
                    </div>
                </Show>
            </div>
        );
    };
}
