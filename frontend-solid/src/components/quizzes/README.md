# BlockPy Quiz System - SolidJS Implementation

This is a SolidJS reimplementation of the BlockPy quizzing system, converted from KnockoutJS. The quiz system allows students to take interactive quizzes with multiple question types and provides instructors with grading and feedback capabilities.

## Overview

The quiz system is built with modern SolidJS reactive primitives, providing:
- Fine-grained reactivity with signals
- Type-safe TypeScript implementation
- Multiple question types support
- Attempt tracking and limits
- Immediate, summary, or no feedback modes
- Instructor and student views

## Architecture

### Core Components

1. **Quiz Model** (`Quiz.ts`)
   - Manages quiz state (attempting, completed, ready)
   - Tracks attempts and answers
   - Handles feedback data
   - Provides computed properties for status

2. **Quizzer Component** (`Quizzer.tsx`)
   - Main quiz interface
   - Controls quiz flow (start, submit, retry)
   - Manages student and instructor views
   - Renders questions based on state

3. **Question Components** (`QuestionComponent.tsx`)
   - Renders different question types
   - Handles answer input
   - Displays feedback
   - Supports readonly mode

### Supported Question Types

- **Multiple Choice** - Single selection from options
- **True/False** - Boolean choice
- **Short Answer** - Text input
- **Multiple Answers** - Multiple selection from options
- **Multiple Dropdowns** - Dropdowns embedded in question text
- **Fill in Multiple Blanks** - Text inputs embedded in question text

Additional types defined but not yet implemented:
- Matching
- Essay
- Numerical

## Key Features

### State Management

The Quiz model uses SolidJS signals for reactive state:

```typescript
// Reactive state
const [attempting, setAttempting] = createSignal(false);
const [attemptCount, setAttemptCount] = createSignal(0);
const [studentAnswers, setStudentAnswers] = createSignal({});
const [feedback, setFeedback] = createSignal({});

// Computed properties
get attemptStatus(): QuizMode {
  if (this.attempting()) {
    return QuizMode.ATTEMPTING;
  } else if (this.attemptCount() > 0) {
    return QuizMode.COMPLETED;
  } else {
    return QuizMode.READY;
  }
}
```

### Quiz Flow

1. **Ready State** - Quiz not yet started
   - Shows start button
   - Displays attempt information
   - Questions hidden for students

2. **Attempting State** - Quiz in progress
   - Shows all questions
   - Enables answer input
   - Submit button active

3. **Completed State** - Quiz finished
   - Shows feedback (based on settings)
   - Displays retry option if attempts remain
   - Questions shown as readonly

### Feedback Modes

- **IMMEDIATE** - Students see feedback immediately after submission
- **SUMMARY** - Limited feedback shown outside exam mode
- **NONE** - No feedback provided

### Attempt Management

```typescript
// Check if can attempt
quiz.canAttempt(): boolean

// Start new attempt
quiz.startQuiz()

// Submit answer for question
quiz.submitAnswer(questionId, answer)

// Submit entire quiz
quiz.submitQuiz()
```

## Usage

### Basic Integration

```html
<script src="static/libs/blockpy_server_solid/frontend-solid.js"></script>

<div id="quiz-container"></div>

<script>
  const quizData = {
    assignmentId: 201,
    courseId: 1,
    userId: 1,
    instructions: {
      settings: {
        attemptLimit: 2,
        feedbackType: 'IMMEDIATE',
        questionsPerPage: -1,
        poolRandomness: 'SEED'
      },
      questions: {
        'q1': {
          id: 'q1',
          type: 'multiple_choice_question',
          body: '<p>What is 2 + 2?</p>',
          points: 1,
          answers: ['3', '4', '5', '6']
        }
      }
    },
    submission: {
      studentAnswers: {},
      attempt: { attempting: false, count: 0 },
      feedback: {}
    }
  };

  frontendSolid.initQuizzer('#quiz-container', quizData, false);
</script>
```

### Instructor Mode

```javascript
// Enable instructor view
frontendSolid.initQuizzer('#quiz-container', quizData, true);
```

## Question Type Examples

### Multiple Choice

```javascript
{
  id: 'q1',
  type: 'multiple_choice_question',
  body: '<p>Which is correct?</p>',
  points: 1,
  answers: ['Option A', 'Option B', 'Option C']
}
```

### True/False

```javascript
{
  id: 'q2',
  type: 'true_false_question',
  body: '<p>Python is interpreted.</p>',
  points: 1
}
```

### Short Answer

```javascript
{
  id: 'q3',
  type: 'short_answer_question',
  body: '<p>What keyword defines a function?</p>',
  points: 1
}
```

### Multiple Answers

```javascript
{
  id: 'q4',
  type: 'multiple_answers_question',
  body: '<p>Select all valid types:</p>',
  points: 2,
  answers: ['int', 'str', 'boolean', 'list']
}
```

### Multiple Dropdowns

```javascript
{
  id: 'q5',
  type: 'multiple_dropdowns_question',
  body: '<p>A <code>for</code> loop uses the [keyword] keyword to iterate over [structure].</p>',
  points: 2,
  retainOrder: false,
  answers: {
    'keyword': ['for', 'while', 'if', 'def'],
    'structure': ['sequences', 'integers', 'strings', 'functions']
  }
}
```

Note: Square brackets `[identifier]` in the body create dropdown boxes. Use `[[` and `]]` to show literal square brackets.

### Fill in Multiple Blanks

```javascript
{
  id: 'q6',
  type: 'fill_in_multiple_blanks_question',
  body: '<p>To define a function, use [keyword1] followed by the [keyword2] and parentheses.</p>',
  points: 2
}
```

Note: Square brackets `[identifier]` in the body create text input boxes. The identifiers become the keys in the answer object.

## Testing

The quiz system includes comprehensive tests:

```bash
npm test
```

**Test Coverage:**
- Quiz model state management (34 tests)
- Advanced question types (18 tests - dropdowns and fill-in-blanks)
- Question rendering
- Attempt limits
- Feedback display
- Instructor/student modes

## Conversion from KnockoutJS

### Key Differences

**Observable → Signal:**
```typescript
// KnockoutJS
this.attempting = ko.observable(false);
this.attempting(true); // Set
this.attempting(); // Get

// SolidJS
const [attempting, setAttempting] = createSignal(false);
setAttempting(true); // Set
attempting(); // Get
```

**Computed → Memo:**
```typescript
// KnockoutJS
this.attemptStatus = ko.pureComputed(() => {
  return this.attempting() ? "ATTEMPTING" : "READY";
});

// SolidJS
const attemptStatus = createMemo(() => {
  return attempting() ? "ATTEMPTING" : "READY";
});
```

**Templates:**
```html
<!-- KnockoutJS -->
<!-- ko if: attempting() -->
<button data-bind="click: submit">Submit</button>
<!-- /ko -->

<!-- SolidJS JSX -->
<Show when={attempting()}>
  <button onClick={submit}>Submit</button>
</Show>
```

## File Structure

```
src/components/quizzes/
├── types.ts              # TypeScript types and interfaces
├── Quiz.ts               # Quiz model with reactive state
├── Quizzer.tsx           # Main quiz component
├── QuestionComponent.tsx # Question rendering components
└── Quizzer.css           # Component styles

tests/
├── fixtures/
│   ├── quiz-multiple-choice.ts   # Simple quiz fixture
│   └── quiz-mixed-types.ts       # Mixed question types
└── unit/
    ├── quiz.test.ts              # Quiz model tests
    └── quizzer.test.tsx          # Component tests
```

## Future Enhancements

- [ ] Implement remaining question types (matching, essay, numerical)
- [ ] Add question pools and randomization
- [ ] Implement pagination (questions per page)
- [ ] Add cooldown period between attempts
- [ ] Connect to backend API for submission
- [ ] Add auto-save functionality
- [ ] Implement quiz timer
- [ ] Add accessibility improvements
- [ ] Create quiz editor interface
- [ ] Improve escaped bracket handling in fill-in-blanks

## Performance

- **Build size**: 40.25 KB (12.57 KB gzipped)
- **Combined with Watcher**: Total bundle remains small
- **Reactive updates**: Only affected DOM nodes update

## Compatibility

- Works alongside existing KnockoutJS frontend
- Uses existing backend API structure
- Compatible with current quiz data format
- No backend changes required

## Development

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Type check
npm run type-check
```

## Demo

Open `quiz-demo.html` in the dev server to see live examples of:
- Simple multiple choice quiz
- Mixed question types
- Instructor view mode
- Different quiz states
