import { createSignal, createEffect, For, Show } from 'solid-js';
import { Reader } from '../reader/Reader';
import { User } from '../../models/user';

export interface TextbookContent {
    header?: string;
    reading?: {
        id: number;
        url: string;
        missing: boolean;
        name: string;
    };
    group?: {
        id: number;
        url: string;
        missing: boolean;
        name: string;
    };
    content?: TextbookContent[];
}

export interface TextbookData {
    settings: Record<string, any>;
    version: number;
    content: TextbookContent[];
}

export interface TextbookProps {
    courseId: number;
    assignmentGroupId?: number;
    textbook: TextbookData;
    isInstructor: boolean;
    user: User;
    initialPageId?: number;
}

export function Textbook(props: TextbookProps) {
    const [currentReadingId, setCurrentReadingId] = createSignal<number | null>(props.initialPageId || null);

    function openReading(id: number, url: string, name: string) {
        setCurrentReadingId(id);
        
        // Update browser history
        const pageUrl = new URL(window.location.href);
        pageUrl.searchParams.set('page', url);
        window.history.pushState({ id, url, name }, '', pageUrl);
        
        // Update document title
        document.title = `${name} - Textbook`;
    }

    // Handle browser back/forward buttons
    createEffect(() => {
        const handlePopState = (e: PopStateEvent) => {
            const data = e.state;
            if (data && data.id) {
                setCurrentReadingId(data.id);
                document.title = `${data.name} - Textbook`;
            }
        };
        
        window.addEventListener('popstate', handlePopState);
        
        return () => {
            window.removeEventListener('popstate', handlePopState);
        };
    });

    return (
        <div class="row" id="textbook">
            {/* Textbook Navigation */}
            <div class="col-md-4 col-lg-3 textbook-navigation" style="max-height: 100vh; overflow-y: auto;">
                <div class="list-group">
                    <For each={props.textbook.content}>
                        {(item) => <TextbookItem 
                            item={item} 
                            indent={0} 
                            currentId={currentReadingId()}
                            onOpenReading={openReading}
                        />}
                    </For>
                </div>
            </div>

            {/* Actual Reader */}
            <div class="col-md-8 col-lg-9">
                <Show when={currentReadingId()}>
                    <Reader
                        courseId={props.courseId}
                        currentAssignmentId={currentReadingId()!}
                        assignmentGroupId={props.assignmentGroupId}
                        isInstructor={props.isInstructor}
                        user={props.user}
                        asPreamble={true}
                    />
                </Show>
                <Show when={!currentReadingId()}>
                    <div class="alert alert-info m-4">
                        <h4>Welcome to the Textbook</h4>
                        <p>Please select a reading from the navigation menu on the left to get started.</p>
                    </div>
                </Show>
            </div>
        </div>
    );
}

interface TextbookItemProps {
    item: TextbookContent;
    indent: number;
    currentId: number | null;
    onOpenReading: (id: number, url: string, name: string) => void;
}

function TextbookItem(props: TextbookItemProps) {
    const paddingLeft = () => `${5 + props.indent * 8}px`;
    const isActive = () => props.item.reading && props.item.reading.id === props.currentId;
    const isDisabled = () => !props.item.reading;
    const isHeader = () => props.indent >= 1;

    const classStyle = () => {
        if (props.item.reading) {
            return isHeader() ? '' : 'list-group-item-info';
        } else {
            return 'disabled list-group-item-secondary';
        }
    };

    const handleClick = () => {
        if (props.item.reading) {
            props.onOpenReading(
                props.item.reading.id,
                props.item.reading.url,
                props.item.reading.name
            );
        }
    };

    return (
        <>
            <Show when={props.item.header || props.item.reading}>
                <div
                    class={`list-group-item list-group-item-action book-item ${classStyle()}`}
                    classList={{ 
                        active: isActive(),
                        disabled: isDisabled()
                    }}
                    style={`padding-left: ${paddingLeft()}; ${isDisabled() ? 'cursor: default;' : 'cursor: pointer;'}`}
                    onClick={handleClick}
                >
                    {props.item.header || props.item.reading?.name}
                </div>
            </Show>
            <Show when={props.item.content}>
                <For each={props.item.content}>
                    {(child) => <TextbookItem 
                        item={child} 
                        indent={props.indent + 1}
                        currentId={props.currentId}
                        onOpenReading={props.onOpenReading}
                    />}
                </For>
            </Show>
        </>
    );
}
