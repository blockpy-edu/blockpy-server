# KnockoutJS to SolidJS Migration Comparison

This document provides a side-by-side comparison of key patterns and implementations between the original KnockoutJS frontend and the new SolidJS prototype.

## Reactivity Patterns

### Observable Values

**KnockoutJS:**
```typescript
this.watchMode = ko.observable(WatchMode.SUMMARY);
this.feedbackMode = ko.observable(FeedbackMode.BOTH);
```

**SolidJS:**
```typescript
const [watchMode, setWatchMode] = createSignal(WatchMode.SUMMARY);
const [feedbackMode, setFeedbackMode] = createSignal(FeedbackMode.BOTH);
```

### Computed Values

**KnockoutJS:**
```typescript
this.isVcrActive = ko.pureComputed(() => {
    return this.watchMode() !== WatchMode.SUMMARY;
}, this);
```

**SolidJS:**
```typescript
const isVcrActive = createMemo(() => watchMode() !== WatchMode.SUMMARY);
```

### Observable Arrays

**KnockoutJS:**
```typescript
this.states = ko.observableArray<SubmissionState>([]);
this.states.push(newState);
```

**SolidJS:**
```typescript
const [states, setStates] = createSignal<SubmissionState[]>([]);
setStates([...states(), newState]);
```

## Component Templates

### Conditional Rendering

**KnockoutJS (HTML with data-bind):**
```html
<!-- ko if: states().length > 0 -->
<div>Content</div>
<!-- /ko -->
```

**SolidJS (JSX):**
```tsx
<Show when={states().length > 0}>
  <div>Content</div>
</Show>
```

### Loops

**KnockoutJS:**
```html
<!-- ko foreach: submissions -->
<div data-bind="text: user.title()"></div>
<!-- /ko -->
```

**SolidJS:**
```tsx
<For each={submissions()}>
  {(submission) => (
    <div>{submission.user.title()}</div>
  )}
</For>
```

### Event Handlers

**KnockoutJS:**
```html
<button data-bind="click: reload.bind(this)">Reload</button>
```

**SolidJS:**
```tsx
<button onClick={reload}>Reload</button>
```

### Dynamic Classes

**KnockoutJS:**
```html
<div data-bind="css: { 'col-md-6': feedbackMode() !== 'Hidden' }">
```

**SolidJS:**
```tsx
<div classList={{ 'col-md-6': feedbackMode() !== FeedbackMode.HIDE }}>
```

## Component Registration

### KnockoutJS Component Registration

```typescript
export const WatcherTemplate = `...template string...`;

ko.components.register("watcher", {
    viewModel: Watcher,
    template: WatcherTemplate
});
```

### SolidJS Component Definition

```typescript
export function Watcher(props: WatcherProps) {
  // Component logic
  return (
    <div>
      {/* JSX template */}
    </div>
  );
}
```

## State Management

### Class-based State (KnockoutJS)

```typescript
export class SubmissionHistory {
    states: KnockoutObservableArray<SubmissionState>;
    watchMode: KnockoutObservable<WatchMode>;
    
    constructor(user: User, assignment: Assignment) {
        this.states = ko.observableArray<SubmissionState>([]);
        this.watchMode = ko.observable(WatchMode.SUMMARY);
    }
    
    switchWatchMode() {
        switch (this.watchMode()) {
            case WatchMode.SUMMARY:
                this.watchMode(WatchMode.FULL);
                break;
        }
    }
}
```

### Function Component with Signals (SolidJS)

```typescript
export function SubmissionHistory(props: SubmissionHistoryProps) {
    const [states, setStates] = createSignal<SubmissionState[]>([]);
    const [watchMode, setWatchMode] = createSignal<WatchMode>(WatchMode.SUMMARY);
    
    function switchWatchMode() {
        if (watchMode() === WatchMode.SUMMARY) {
            setWatchMode(WatchMode.FULL);
        }
    }
    
    return <div>...</div>;
}
```

## Data Model Access

Both implementations maintain similar model APIs for consistency:

**Both KnockoutJS and SolidJS:**
```typescript
user.firstName()  // Method-style getter
user.title()      // Computed property
```

This allows the models to be reused with minimal changes.

## AJAX Calls

### KnockoutJS

```typescript
ajax_post("blockpy/load_history", {
    assignment_id: this.assignmentId,
    course_id: this.courseId,
}).then((data) => {
    if (data.success) {
        this.addLogs(data.history);
    }
});
```

### SolidJS

```typescript
const data = await ajax_post<ResponseType>('blockpy/load_history', {
    assignment_id: assignmentId,
    course_id: courseId,
});

if (data.success) {
    addLogs(data.history);
}
```

## Template Integration

### KnockoutJS Integration

```html
<script type='text/javascript'>
    $(function() {
        let mainModel = {
            pageCourseId: {{ course_id|tojson }},
            server: server
        };
        ko.applyBindings(mainModel);
    });
</script>

<watcher params="server: server, courseId: pageCourseId"></watcher>
```

### SolidJS Integration

```html
<script type='text/javascript'>
    document.addEventListener('DOMContentLoaded', function() {
        frontendSolid.initWatcher('#watcher-container', {
            courseId: {{ course_id|tojson }},
            assignmentIds: assignmentIds,
            userIds: userIds
        });
    });
</script>

<div id="watcher-container"></div>
```

## Key Advantages of SolidJS

1. **Fine-grained Reactivity**: Only the exact DOM nodes that depend on changed signals are updated
2. **TypeScript Support**: Better type inference and IDE support
3. **Modern Syntax**: JSX is more familiar to modern developers
4. **Performance**: No virtual DOM overhead, direct DOM manipulation
5. **Smaller Bundle Size**: SolidJS runtime is smaller than KnockoutJS
6. **Better Developer Experience**: Hot module replacement, better error messages
7. **Component Composition**: Easier to compose and reuse components

## Migration Strategy

For a complete migration:

1. Convert components one at a time, starting with leaf components
2. Both frontends can coexist during migration
3. Update templates to use new components as they're completed
4. Maintain backward compatibility with existing API
5. Test thoroughly at each step
6. Complete migration when all components are converted

## File Size Comparison

- **KnockoutJS build**: ~150KB (bundled with all components)
- **SolidJS prototype**: ~27KB (just Watcher component)

The SolidJS version is significantly smaller, and the gap will remain even with all components implemented due to SolidJS's efficient runtime.
