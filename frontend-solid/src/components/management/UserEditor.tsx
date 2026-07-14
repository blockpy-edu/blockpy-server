import { Component, createSignal } from 'solid-js';

export enum SortOrder {
    FIRST_LAST = 'first_last',
    LAST_FIRST = 'last_first',
    EMAIL = 'email',
    BLOCKPY_ID = 'blockpy_id',
    DATE_CREATED = 'date_created'
}

export enum RenderStyle {
    COMPACT = 'compact',
    DETAILED = 'detailed'
}

interface UserEditorProps {
    initialSortOrder?: SortOrder;
    initialRenderStyle?: RenderStyle;
    onSortOrderChange?: (order: SortOrder) => void;
    onRenderStyleChange?: (style: RenderStyle) => void;
}

export const UserEditor: Component<UserEditorProps> = (props) => {
    const [sortOrder, setSortOrder] = createSignal<SortOrder>(
        props.initialSortOrder || SortOrder.FIRST_LAST
    );
    const [renderStyle, setRenderStyle] = createSignal<RenderStyle>(
        props.initialRenderStyle || RenderStyle.DETAILED
    );

    const handleSortOrderChange = (e: Event) => {
        const value = (e.target as HTMLSelectElement).value as SortOrder;
        setSortOrder(value);
        props.onSortOrderChange?.(value);
    };

    const handleRenderStyleChange = (e: Event) => {
        const value = (e.target as HTMLSelectElement).value as RenderStyle;
        setRenderStyle(value);
        props.onRenderStyleChange?.(value);
    };

    return (
        <div class="user-editor">
            <h3>User Settings</h3>
            
            <div class="form-group">
                <label for="render-style">Render Style:</label>
                <select 
                    id="render-style"
                    class="form-control"
                    value={renderStyle()}
                    onChange={handleRenderStyleChange}
                >
                    <option value={RenderStyle.COMPACT}>Compact</option>
                    <option value={RenderStyle.DETAILED}>Detailed</option>
                </select>
            </div>

            <div class="form-group">
                <label for="sort-order">Sort Order:</label>
                <select 
                    id="sort-order"
                    class="form-control"
                    value={sortOrder()}
                    onChange={handleSortOrderChange}
                >
                    <option value={SortOrder.FIRST_LAST}>First, Last</option>
                    <option value={SortOrder.LAST_FIRST}>Last, First</option>
                    <option value={SortOrder.EMAIL}>Email</option>
                    <option value={SortOrder.BLOCKPY_ID}>BlockPy ID</option>
                    <option value={SortOrder.DATE_CREATED}>Date Created</option>
                </select>
            </div>
        </div>
    );
};
