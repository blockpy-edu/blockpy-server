# Tests for SolidJS Frontend

This directory contains comprehensive tests for the SolidJS frontend prototype.

## Test Structure

```
tests/
├── fixtures/           # Realistic test data
│   ├── basic-session.ts       # Simple successful session
│   ├── error-session.ts       # Session with errors and corrections
│   ├── complex-session.ts     # Multiple students and assignments
│   └── edge-cases.ts          # Edge cases and unusual scenarios
├── unit/              # Unit tests
│   ├── log.test.ts            # Log model tests
│   ├── models.test.ts         # User, Assignment, Submission tests
│   ├── dates.test.ts          # Date utility tests
│   ├── submission-state.test.ts  # SubmissionState class tests
│   ├── watcher.test.tsx       # Watcher component tests
│   └── submission-history.test.tsx  # SubmissionHistory component tests
└── setup.ts           # Test setup and configuration
```

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests with UI
```bash
npm run test:ui
```

### Run tests with coverage
```bash
npm run test:coverage
```

### Watch mode (auto-rerun on changes)
```bash
npm test -- --watch
```

## Test Fixtures

The fixtures directory contains realistic test data representing different scenarios:

### Basic Session (`basic-session.ts`)
- **Scenario**: Student creates a file, makes edits, runs code successfully
- **User**: Alice Johnson
- **Assignment**: Hello World Assignment
- **Events**: 6 events from session start to LMS submission
- **Outcome**: Successful completion with score of 100

### Error Session (`error-session.ts`)
- **Scenario**: Student encounters compilation and runtime errors, eventually succeeds
- **User**: Bob Smith
- **Assignment**: For Loop Practice
- **Events**: 10 events including syntax errors and corrections
- **Outcome**: Successful after multiple attempts, score of 85

### Complex Session (`complex-session.ts`)
- **Scenario**: Multiple students working on different assignments simultaneously
- **Users**: Charlie Brown, Diana Prince, Eve Williams
- **Assignments**: Variables and Types, Functions, Lists and Loops
- **Events**: 14 events across multiple users
- **Outcome**: Various completion states and scores

### Edge Cases (`edge-cases.ts`)
- **Scenarios**: 
  - Empty session (student opened but didn't work)
  - Runtime errors with proper exception handling
  - View mode changes (blocks ↔ text)
  - Rapid edits in quick succession
- **Users**: Frank Miller, Grace Hopper, Henry Ford
- **Events**: Various edge case events
- **Outcome**: Different outcomes testing boundary conditions

## Test Coverage

### Models
- ✅ Log model: Creation, event type remapping, submission keys
- ✅ User model: Name formatting, title generation
- ✅ Assignment model: Basic properties, optional fields
- ✅ Submission model: CRUD operations, key generation, updates

### Utilities
- ✅ Date formatting: All format functions
- ✅ Duration calculation: Seconds, minutes, hours, days
- ✅ Edge cases: Null values, single vs plural

### Components
- ✅ SubmissionState: All event types, state transitions
- ✅ Watcher: Loading, error handling, API calls, grouping
- ✅ SubmissionHistory: VCR controls, modes, display

## Test Data Characteristics

### Realistic Scenarios
- Real student names and emails
- Actual Python code examples
- Realistic timestamps and durations
- Proper error messages
- Authentic feedback messages

### Variety of Cases
- ✅ Successful submissions
- ✅ Failed submissions
- ✅ Syntax errors
- ✅ Runtime errors
- ✅ Multiple iterations/corrections
- ✅ View mode changes
- ✅ Different student behaviors
- ✅ Empty/incomplete sessions
- ✅ Rapid editing patterns

### Event Types Covered
- ✅ Session.Start
- ✅ File.Create
- ✅ File.Edit (single and rapid)
- ✅ Compile
- ✅ Compile.Error
- ✅ Run.Program (success and error)
- ✅ Intervention (complete and incomplete)
- ✅ X-View.Change
- ✅ X-Submission.LMS

## Writing New Tests

### Unit Test Template
```typescript
import { describe, it, expect } from 'vitest';

describe('MyComponent', () => {
  it('should do something', () => {
    // Arrange
    const input = 'test';
    
    // Act
    const result = myFunction(input);
    
    // Assert
    expect(result).toBe('expected');
  });
});
```

### Component Test Template
```typescript
import { render, screen } from '@solidjs/testing-library';

describe('MyComponent', () => {
  it('should render', () => {
    render(() => <MyComponent prop="value" />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });
});
```

### Adding New Fixtures
When adding new fixtures:
1. Use realistic data (real names, proper code syntax)
2. Include all required fields in JSON objects
3. Use consistent course_id (1) across fixtures
4. Increment IDs properly (users: 1-N, assignments: 101-N, etc.)
5. Document the scenario at the top of the file

## CI/CD Integration

Tests run automatically on:
- ✅ Pull requests
- ✅ Commits to main branch
- ✅ Manual workflow dispatch

## Debugging Tests

### Run specific test file
```bash
npm test -- tests/unit/log.test.ts
```

### Run tests matching pattern
```bash
npm test -- --grep "Log Model"
```

### Debug in VS Code
Add this to `.vscode/launch.json`:
```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Vitest",
  "runtimeExecutable": "npm",
  "runtimeArgs": ["test", "--", "--inspect-brk"],
  "console": "integratedTerminal"
}
```

## Best Practices

1. **Isolation**: Each test should be independent
2. **Clear names**: Test names should describe what they test
3. **Arrange-Act-Assert**: Structure tests clearly
4. **Realistic data**: Use test fixtures that match real usage
5. **Mock external dependencies**: Mock AJAX calls, timers, etc.
6. **Clean up**: Use afterEach for cleanup
7. **Test edge cases**: Don't just test happy paths

## Future Improvements

- [ ] Add E2E tests with Playwright
- [ ] Add visual regression tests
- [ ] Add performance benchmarks
- [ ] Add accessibility tests
- [ ] Increase coverage to 90%+
- [ ] Add mutation testing
