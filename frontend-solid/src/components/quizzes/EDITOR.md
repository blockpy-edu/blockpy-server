# Quiz Editor

Interactive quiz creation and editing interface with comprehensive undo/redo functionality.

## Features

### Core Functionality
- ✅ Add new questions (6 question types supported)
- ✅ Delete questions with confirmation
- ✅ Reorder questions (move up/down)
- ✅ Edit question body inline
- ✅ Change question types dynamically
- ✅ Modify question points
- ✅ Save quiz data

### Undo/Redo System
- ✅ Full undo/redo support for all operations
- ✅ Keyboard shortcuts (Ctrl+Z / Ctrl+Shift+Z)
- ✅ Action history tracking
- ✅ Smart redo stack management

### User Experience
- ✅ Inline editing (click question body to edit)
- ✅ Visual feedback for selected questions
- ✅ Question numbering badges
- ✅ Question type and points display
- ✅ Empty state message
- ✅ Sticky toolbar
- ✅ Confirmation dialogs for destructive actions

## Usage

### Basic Integration

```html
<div id="quiz-editor"></div>

<script src="{{ url_for('static', filename='libs/blockpy_server_solid/frontend-solid.js') }}"></script>
<script>
  const quizData = {
    assignmentId: 1,
    courseId: 1,
    userId: 1,
    instructions: {
      settings: {
        attemptLimit: -1,
        coolDown: -1,
        feedbackType: 'IMMEDIATE',
        questionsPerPage: -1,
        poolRandomness: 'NONE',
        readingId: null
      },
      pools: [],
      questions: {}
    },
    submission: {
      studentAnswers: {},
      attempt: { attempting: false, count: 0, mulligans: 0 },
      feedback: {}
    }
  };

  // Initialize editor
  frontendSolid.initQuizEditor('#quiz-editor', quizData, (savedData) => {
    console.log('Quiz saved:', savedData);
    // Send to backend API
  });
</script>
```

### With TypeScript

```typescript
import { initQuizEditor, QuizData } from './app';

const quizData: QuizData = { /* ... */ };

initQuizEditor('#quiz-editor', quizData, (savedData) => {
  // Handle save
  fetch('/api/save-quiz', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(savedData)
  });
});
```

## Operations

### Adding Questions

Click "Add Question" button or use the dropdown to select a specific question type:
- Multiple Choice
- True/False
- Short Answer
- Multiple Answers
- Multiple Dropdowns
- Fill in Blanks

New questions are created with default content and can be edited immediately.

### Editing Questions

1. **Body Text**: Click on the question body to enter edit mode. A textarea appears for editing.
2. **Question Type**: Select a question to reveal the options panel, then use the type dropdown.
3. **Points**: Use the points input field in the options panel.

### Reordering Questions

Use the up/down arrow buttons in each question's header to reorder. First question can't move up, last question can't move down.

### Deleting Questions

Click the trash icon button. A confirmation dialog appears to prevent accidental deletion.

### Undo/Redo

- **Undo**: Click the "Undo" button or press `Ctrl+Z` (or `Cmd+Z` on Mac)
- **Redo**: Click the "Redo" button or press `Ctrl+Shift+Z` (or `Cmd+Shift+Z` on Mac)

Supports undo/redo for:
- Adding questions
- Deleting questions
- Reordering questions
- Editing question body
- Changing question type

### Saving

Click "Save Quiz" button. The `onSave` callback receives the complete updated quiz data structure.

## Action History

The toolbar displays:
- **Question count**: Total number of questions
- **Action history**: Number of actions in undo stack

The redo stack is cleared whenever a new action is performed after undoing.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Z` | Undo last action |
| `Ctrl+Shift+Z` | Redo last undone action |
| `Cmd+Z` | Undo (Mac) |
| `Cmd+Shift+Z` | Redo (Mac) |

## Question Types

The editor supports creating and editing these question types:

1. **Multiple Choice** - Radio button selection, requires `answers` array
2. **True/False** - Boolean choice, no additional properties
3. **Short Answer** - Text input, no additional properties
4. **Multiple Answers** - Checkbox selection, requires `answers` array
5. **Multiple Dropdowns** - Embedded dropdowns, requires `answers` object and optional `retainOrder`
6. **Fill in Blanks** - Embedded text inputs, no additional properties

When changing question type, the editor intelligently adds required properties and preserves body/points.

## Styling

The editor uses Bootstrap classes and includes custom styles via `QuizEditor.css`:
- Sticky toolbar at top
- Hover effects on questions
- Selected question highlight
- Smooth animations
- Responsive layout

## API

### initQuizEditor

```typescript
function initQuizEditor(
  container: HTMLElement | string,
  quizData: QuizData,
  onSave?: (data: QuizData) => void
): void
```

**Parameters:**
- `container`: DOM element or CSS selector for mount point
- `quizData`: Initial quiz data structure
- `onSave`: Optional callback when quiz is saved

### QuizData Structure

```typescript
interface QuizData {
  assignmentId: number;
  courseId: number;
  userId: number;
  instructions: {
    settings: QuizSettings;
    pools: QuestionPool[];
    questions: Record<string, Question>;
  };
  submission: {
    studentAnswers: Record<string, any>;
    attempt: {
      attempting: boolean;
      count: number;
      mulligans: number;
    };
    feedback: Record<string, any>;
  };
}
```

## Examples

### Empty Quiz

```javascript
const emptyQuiz = {
  assignmentId: 1,
  courseId: 1,
  userId: 1,
  instructions: {
    settings: { /* ... */ },
    pools: [],
    questions: {}  // Empty
  },
  submission: { /* ... */ }
};

initQuizEditor('#editor', emptyQuiz, handleSave);
```

### Pre-populated Quiz

```javascript
const existingQuiz = {
  // ... basic structure
  instructions: {
    settings: { /* ... */ },
    pools: [],
    questions: {
      'q1': {
        id: 'q1',
        type: 'multiple_choice_question',
        body: '<p>What is Python?</p>',
        points: 2,
        answers: ['A language', 'A snake', 'A framework']
      },
      'q2': {
        id: 'q2',
        type: 'true_false_question',
        body: '<p>Python is interpreted.</p>',
        points: 1
      }
    }
  }
};

initQuizEditor('#editor', existingQuiz, handleSave);
```

## Testing

14+ passing tests covering:
- Initialization and rendering
- Adding/deleting questions
- Reordering questions
- Editing questions
- Changing question types
- Undo/redo functionality
- Save functionality
- Action history
- Empty state

Run tests:
```bash
npm test quiz-editor
```

## Performance

- **Build size**: Adds ~10 KB to bundle (49.97 KB total vs 40.25 KB without editor)
- **Memory**: Efficient undo/redo implementation with minimal memory overhead
- **Reactivity**: Only affected DOM nodes update when state changes

## Browser Support

Same as main SolidJS frontend:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Modern mobile browsers

## Future Enhancements

- [ ] Drag-and-drop reordering
- [ ] Bulk operations (delete multiple, move multiple)
- [ ] Copy/paste questions
- [ ] Question templates
- [ ] Rich text editor for question body
- [ ] Answer option editing (for MC/MA questions)
- [ ] Question preview mode
- [ ] Import/export questions
- [ ] Question bank integration
- [ ] Collaborative editing
- [ ] Auto-save functionality
- [ ] Version history

## Related Components

- **Quizzer**: Student quiz-taking interface
- **QuestionComponent**: Renders individual questions
- **Quiz Model**: Quiz state management

## Dependencies

- SolidJS 1.8.11+
- Bootstrap 5.3+ (for styling)
- Bootstrap Icons (for toolbar icons)
