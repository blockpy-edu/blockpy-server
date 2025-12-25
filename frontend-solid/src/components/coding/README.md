# Coding Assignment Component

A comprehensive coding environment component for BlockPy Server that supports both Python and TypeScript code editing and execution.

## Features

### Top Section
- **Left Side**: Assignment name and markdown-rendered description
- **Right Side**: 
  - Instructor/Student view toggle (instructors only)
  - Run Code button
  - Utility buttons:
    - Toggle fullscreen
    - Edit reusable inputs
    - Get shareable link
    - View instructor stdout (instructors only)
    - Edit seed (instructors only)

### Middle Section (3 Modes)

**1. Split Mode (Default)**
- Left: Console displaying stdout/stderr and REPL
- Right: Feedback panel with instructor-generated messages

**2. Trace Mode**
- Full-width trace viewer with VCR controls
- Step through execution line by line
- View variable states at each step
- See current file and line number

**3. Console Stretch Mode**
- Console spans full width
- Useful for viewing large output

### Bottom Section: File Editor
- **Main Tab**: Primary code file (main.py or main.ts)
- **Additional Files**: Multiple file support with tabs
- **Instructor Config Tabs** (instructors only):
  - Instructions editor (markdown)
  - Autograding logic
  - Initial student code
  - Assignment settings
  - Add new files button

## Components

### CodingAssignment (Main)
The main component that orchestrates all sub-components.

```typescript
import { CodingAssignment } from './components/coding/CodingAssignment';

<CodingAssignment
    assignment={assignmentData}
    user={currentUser}
    courseId={courseId}
    isInstructor={isInstructor}
/>
```

### Console
Displays program output and provides REPL interface after code execution.

**Features:**
- Color-coded stdout (white) and stderr (red)
- REPL prompt (`>>>`) after successful execution
- Execute button for REPL input
- Scrollable output area

### FeedbackPanel
Shows instructor-generated feedback messages with priority levels.

**Features:**
- Priority badges (high/medium/low)
- Markdown rendering for message bodies
- Category and label display
- Toggle buttons for Trace mode and Console Stretch
- Empty state when no feedback

### TraceViewer
Interactive execution trace viewer with VCR-style controls.

**Controls:**
- First Step: Jump to beginning
- Step Back 5: Move back 5 steps
- Previous: Move back 1 step
- Next: Move forward 1 step
- Step Forward 5: Move forward 5 steps
- Last Step: Jump to end

**Display:**
- Current step number / total steps
- File name and line number
- Output at current step
- Variable state table (name/type/value)

### FileEditor
Tab-based code editor with support for multiple files.

**Features:**
- Syntax highlighting (via CSS)
- File tabs with icons
- Close button for non-main files
- Add file button (instructors only)
- Line and character count
- Language badges
- Instructor-only config tabs

## Data Types

### CodingAssignmentData
```typescript
interface CodingAssignmentData {
    id: number;
    name: string;
    instructions: string; // Markdown
    runtime: 'python' | 'typescript';
    files: CodeFile[];
    mainFile: string;
    autograde?: string;
    initialCode?: string;
    settings?: AssignmentSettings;
    submission?: StudentSubmission;
}
```

### ExecutionResult
```typescript
interface ExecutionResult {
    stdout: string;
    stderr: string;
    error?: string;
    success: boolean;
    trace?: ExecutionTrace;
}
```

### FeedbackMessage
```typescript
interface FeedbackMessage {
    title: string;
    category: string;
    label: string;
    body: string; // Markdown
    priority?: 'low' | 'medium' | 'high';
    timestamp?: number;
}
```

### ExecutionTrace
```typescript
interface ExecutionTrace {
    steps: TraceStep[];
    currentStep: number;
}

interface TraceStep {
    line: number;
    file: string;
    variables: VariableState[];
    stdout?: string;
}

interface VariableState {
    name: string;
    type: string;
    value: string;
}
```

## Backend API Endpoints

### Execute Code
```
POST /api/execute
Body: {
    runtime: 'python' | 'typescript',
    files: { [filename: string]: string },
    mainFile: string,
    autograde?: string
}
Response: ExecutionResult
```

### Execute REPL
```
POST /api/execute/repl
Body: {
    runtime: 'python' | 'typescript',
    code: string,
    context: ExecutionResult
}
Response: {
    output: string
}
```

## Integration with AssignmentInterface

The Coding component integrates with the shared `AssignmentInterface` service for:
- Time limit tracking
- Event logging (Run.Program, File.Edit, etc.)
- File saving (submission persistence)
- Assignment loading

## Usage Example

```typescript
import { render } from 'solid-js/web';
import { CodingAssignment } from './components/coding/CodingAssignment';

const assignmentData: CodingAssignmentData = {
    id: 1,
    name: 'Hello World',
    instructions: '# Hello World\n\nWrite a program that prints "Hello, World!"',
    runtime: 'python',
    files: [
        {
            name: 'main.py',
            content: '# Write your code here\n',
            language: 'python'
        }
    ],
    mainFile: 'main.py',
    initialCode: '# Write your code here\n',
    settings: {
        timeLimit: '60min',
        enableTrace: true,
        enableRepl: true
    }
};

render(
    () => <CodingAssignment
        assignment={assignmentData}
        user={currentUser}
        courseId={123}
        isInstructor={false}
    />,
    document.getElementById('coding-container')!
);
```

## Keyboard Shortcuts

- **Ctrl+Enter**: Run code (from any file tab)
- **Escape**: Exit fullscreen mode

## Styling

The component uses Bootstrap 5 classes for layout and styling. Custom styling includes:
- Dark theme for console and code editor (#1e1e1e background)
- Color-coded console output
- Monospace fonts for code
- Responsive design with Bootstrap grid

## Future Enhancements

- Syntax highlighting with Monaco Editor or CodeMirror
- Autocomplete and IntelliSense
- Collaborative editing
- Version history and diff viewer
- Breakpoint debugging
- Test runner integration
- Code formatting (Prettier/Black)
- Linting (ESLint/Pylint)
- Multiple runtime support (JavaScript, Java, C++, etc.)
