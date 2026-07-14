# BlockPy Server - SolidJS Frontend Prototype

This is a prototype reimplementation of BlockPy Server's frontend using SolidJS, a modern reactive JavaScript framework. This prototype focuses on the core infrastructure and the **Watcher** component as a proof of concept.

## Overview

The original BlockPy frontend is built with KnockoutJS. This SolidJS version aims to provide the same functionality with:
- Modern reactive primitives (signals, effects, memos)
- Better TypeScript support
- Improved performance through fine-grained reactivity
- Modern build tooling (Vite)

## Project Structure

```
frontend-solid/
├── src/
│   ├── components/
│   │   └── watcher/
│   │       ├── Watcher.tsx           # Main watcher component
│   │       ├── SubmissionHistory.tsx  # Submission history display
│   │       ├── SubmissionState.ts     # State management for submissions
│   │       └── SubmissionHistory.css  # Component styles
│   ├── models/
│   │   ├── log.ts           # Log model and types
│   │   ├── user.ts          # User model
│   │   ├── assignment.ts    # Assignment model
│   │   └── submission.ts    # Submission model
│   ├── services/
│   │   └── ajax.ts          # AJAX utilities for API calls
│   ├── utilities/
│   │   └── dates.ts         # Date formatting utilities
│   └── app.tsx              # Main entry point
├── index.html               # Development HTML
├── package.json             # Dependencies
├── tsconfig.json            # TypeScript configuration
├── tsconfig.node.json       # TypeScript config for build tools
├── vite.config.ts           # Vite build configuration
└── README.md                # This file
```

## Key Components

### Watcher Component

The Watcher component (`src/components/watcher/Watcher.tsx`) is the main interface for instructors to monitor student activity. It:
- Loads submission history for selected users and assignments
- Groups submissions by user or assignment
- Displays real-time updates of student progress

### SubmissionHistory Component

The SubmissionHistory component displays detailed information about a single student's work on an assignment:
- Timeline of events (edits, runs, submissions)
- VCR-style controls to replay student's work
- Code viewer showing state at each point in time
- Feedback and system messages display

### SubmissionState

A class that represents the state of a submission at a specific point in time, tracking:
- Code content
- Feedback messages
- System messages
- Completion status
- Timestamps for various events

## Installation

```bash
cd frontend-solid
npm install
```

## Development

Run the development server:

```bash
npm run dev
```

This will start Vite's dev server, typically at `http://localhost:5173`.

## Building for Production

Build the production bundle:

```bash
npm run build
```

This creates:
- `../static/libs/blockpy_server_solid/frontend-solid.js` - The main bundle
- `../static/libs/blockpy_server_solid/frontend-solid.css` - Extracted styles

These files are placed in the `static/libs/blockpy_server_solid/` directory to match the original frontend's output location.

## Integration with Templates

The SolidJS frontend can be integrated into Jinja templates similar to the original:

```html
{% block extrahead %}
<link rel="stylesheet" href="{{ url_for('static', filename='libs/blockpy_server_solid/frontend-solid.css') }}">
<script src="{{ url_for('static', filename='libs/blockpy_server_solid/frontend-solid.js') }}"></script>

<script type='text/javascript'>
  document.addEventListener('DOMContentLoaded', function() {
    frontendSolid.initWatcher('#watcher-container', {
      courseId: {{ course_id }},
      assignmentIds: '{{ assignment_ids }}',
      userIds: '{{ user_ids }}',
      defaultWatchMode: frontendSolid.WatchMode.SUMMARY
    });
  });
</script>
{% endblock %}

{% block body %}
<div id="watcher-container"></div>
{% endblock %}
```

## Migration from KnockoutJS

### Key Differences

1. **Reactivity Model**:
   - KnockoutJS: Observable-based (`ko.observable()`, `ko.computed()`)
   - SolidJS: Signal-based (`createSignal()`, `createMemo()`)

2. **Templates**:
   - KnockoutJS: String templates with `data-bind` attributes
   - SolidJS: JSX components with reactive primitives

3. **Component Registration**:
   - KnockoutJS: `ko.components.register()`
   - SolidJS: Direct component imports and usage

### Example Conversion

**KnockoutJS:**
```typescript
this.watchMode = ko.observable(WatchMode.SUMMARY);
this.isVcrActive = ko.pureComputed(() => {
  return this.watchMode() !== WatchMode.SUMMARY;
});
```

**SolidJS:**
```typescript
const [watchMode, setWatchMode] = createSignal(WatchMode.SUMMARY);
const isVcrActive = createMemo(() => watchMode() !== WatchMode.SUMMARY);
```

## Future Work

This prototype demonstrates the core infrastructure. Future work includes:

- [ ] Implement remaining components (AssignmentManager, CourseList, etc.)
- [ ] Add user/assignment selector components
- [ ] Implement real-time polling/websocket support
- [ ] Add comprehensive error handling
- [ ] Create unit tests
- [ ] Add integration tests
- [ ] Implement code syntax highlighting
- [ ] Add more sophisticated state management (if needed)
- [ ] Performance optimization
- [ ] Accessibility improvements

## Technology Stack

- **SolidJS** - Reactive UI framework
- **TypeScript** - Type-safe JavaScript
- **Vite** - Build tool and dev server
- **Bootstrap 5** - CSS framework (inherited from original)
- **Font Awesome** - Icon library

## Notes

- This prototype maintains compatibility with the existing backend API
- The component structure mirrors the original KnockoutJS implementation for easier comparison
- Models use method-style getters (e.g., `user.firstName()`) to match the original API
- The build output is configured to work alongside the existing frontend without conflicts
