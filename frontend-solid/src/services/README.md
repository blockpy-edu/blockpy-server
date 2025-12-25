# Services

This directory contains shared service classes and utilities used across the SolidJS frontend.

## AssignmentInterface

`assignment-interface.ts` - Shared logic for assignment-based components (Quiz, Reader, etc.)

### Features

- **Time Limit Tracking**: Automatic exam timer with countdown display
- **Event Logging**: Log student activities (reading, watching videos, quiz attempts)
- **File Management**: Save/load assignment files and submissions
- **Assignment Loading**: Load assignment and submission data from backend
- **Settings Management**: Save assignment settings (instructor only)

### Usage Example

```typescript
import { AssignmentInterface, EditorMode } from '../services/assignment-interface';

// In your component
const assignmentInterface = new AssignmentInterface({
    courseId: 123,
    assignmentGroupId: 456,
    user: currentUser,
    isInstructor: false,
    currentAssignmentId: 789,
    markCorrect: (assignmentId) => {
        console.log('Assignment marked correct:', assignmentId);
    }
});

// Access reactive state
const assignment = assignmentInterface.assignment;
const submission = assignmentInterface.submission;
const isInstructor = assignmentInterface.isInstructor;

// Load an assignment
await assignmentInterface.loadAssignment(assignmentId);

// Log an event
assignmentInterface.logEvent(
    'Resource.View',
    'reading',
    'read',
    JSON.stringify({ count: 1 }),
    assignment().url(),
    () => console.log('Logged!')
);

// Save a file
await assignmentInterface.saveFile(
    'answer.py',
    '# My answer\nprint("Hello")',
    false, // block
    (response) => console.log('Saved:', response)
);

// Save assignment settings (instructor)
await assignmentInterface.saveAssignmentSettings({
    settings: JSON.stringify({ time_limit: '60min' }),
    points: 100,
    name: 'My Quiz'
});
```

### Time Limit System

The AssignmentInterface automatically checks time limits every 5 seconds:

1. Parses time limit from assignment settings (e.g., "60min", "2x")
2. Calculates elapsed time from submission start time
3. Updates countdown display in `.assignment-selector-countdown` element
4. Shows time-up overlay when time expires (students only)

Time limit formats:
- `"60min"` - 60 minutes absolute
- `"2x"` - 2 times base time limit (student modifier)
- `"90"` - 90 minutes (no "min" suffix)

### Integration with Components

**Reader Component:**
```typescript
// In Reader.tsx
const assignmentInterface = new AssignmentInterface({...});

// Load reading
await assignmentInterface.loadAssignment(assignmentId);

// Log reading activity every 30 seconds
assignmentInterface.logEvent(
    'Resource.View',
    'reading',
    'read',
    JSON.stringify({ count, progress }),
    assignment().url(),
    callback
);
```

**Quiz Component:**
```typescript
// In Quizzer.tsx
const assignmentInterface = new AssignmentInterface({...});

// Load quiz
await assignmentInterface.loadAssignment(assignmentId);

// Save quiz answers
await assignmentInterface.saveFile(
    'answer.py',
    quiz.toSubmissionJSON(),
    false,
    () => console.log('Saved')
);

// Submit quiz for grading
await assignmentInterface.saveFile(
    'answer.py',
    quiz.toSubmissionJSON(),
    true, // block until complete
    () => console.log('Submitted')
);
```

### API Endpoints

The AssignmentInterface communicates with these backend endpoints:

- `POST /blockpy/load_assignment/` - Load assignment and submission
- `POST /blockpy/log_event/` - Log student activity
- `POST /blockpy/save_file/` - Save file (submission code, instructions, etc.)
- `POST /blockpy/save_assignment/` - Save assignment settings (instructor)

### Cleanup

The AssignmentInterface automatically cleans up resources on component unmount:
- Clears time checker interval
- Removes global time checker reference

This is handled via SolidJS `onCleanup` hook.

## AJAX Service

`ajax.ts` - HTTP request utilities

### Functions

- `ajaxPost(url, data)` - POST request with JSON body
- `ajaxGet(url, params)` - GET request with query parameters

### Usage

```typescript
import { ajaxPost } from '../services/ajax';

const response = await ajaxPost('/api/endpoint', {
    key: 'value'
});
```

## Benefits of Shared AssignmentInterface

1. **Code Reuse**: Common logic extracted from Quiz and Reader
2. **Consistency**: Same behavior across all assignment types
3. **Maintainability**: Single source of truth for assignment operations
4. **Extensibility**: Easy to add new assignment types (e.g., Coding, Essay)
5. **Testing**: Centralized testing for shared functionality

## Future Assignment Types

The AssignmentInterface is designed to support future assignment types:

- **Coding Assignments**: BlockPy/code editor integration
- **Essay Assignments**: Long-form text with rubric grading
- **File Upload Assignments**: Student file submissions
- **Peer Review Assignments**: Student-to-student review workflow
- **External Tool Assignments**: LTI tool integration

Each new type can leverage the shared functionality while implementing type-specific features.
