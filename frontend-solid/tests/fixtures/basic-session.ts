/**
 * Test fixture: Basic student submission with simple edits
 * Scenario: Student creates a file, makes a few edits, runs code successfully
 */

import { LogJson } from '../../src/models/log';
import { UserJson } from '../../src/models/user';
import { AssignmentJson } from '../../src/models/assignment';
import { SubmissionJson } from '../../src/models/submission';

export const basicStudentUser: UserJson = {
  id: 1,
  first_name: 'Alice',
  last_name: 'Johnson',
  email: 'alice.johnson@example.edu'
};

export const simpleAssignment: AssignmentJson = {
  id: 101,
  name: 'Hello World Assignment',
  body: 'Write a program that prints "Hello, World!"'
};

export const basicSubmission: SubmissionJson = {
  id: 1001,
  user_id: 1,
  assignment_id: 101,
  course_id: 1,
  code: 'print("Hello, World!")',
  correct: true,
  score: 100
};

export const basicSessionLogs: LogJson[] = [
  {
    id: 1,
    event_type: 'Session.Start',
    message: '',
    category: 'Session',
    label: 'Session Started',
    when: '2024-01-15T10:00:00Z',
    subject_id: 1,
    assignment_id: 101,
    course_id: 1,
    client_timestamp: '2024-01-15T10:00:00Z',
    date_created: '2024-01-15T10:00:00Z'
  },
  {
    id: 2,
    event_type: 'File.Create',
    message: 'print("Hello")',
    category: 'File',
    label: 'File Created',
    when: '2024-01-15T10:00:30Z',
    subject_id: 1,
    assignment_id: 101,
    course_id: 1,
    client_timestamp: '2024-01-15T10:00:30Z',
    date_created: '2024-01-15T10:00:30Z'
  },
  {
    id: 3,
    event_type: 'File.Edit',
    message: 'print("Hello, World!")',
    category: 'File',
    label: 'File Edited',
    when: '2024-01-15T10:01:00Z',
    subject_id: 1,
    assignment_id: 101,
    course_id: 1,
    client_timestamp: '2024-01-15T10:01:00Z',
    date_created: '2024-01-15T10:01:00Z'
  },
  {
    id: 4,
    event_type: 'Run.Program',
    message: '{"output": "[{\\"type\\": \\"text\\", \\"contents\\": \\"Hello, World!\\"}]", "errors": "[]"}',
    category: 'ProgramOutput',
    label: 'Program Executed',
    when: '2024-01-15T10:01:30Z',
    subject_id: 1,
    assignment_id: 101,
    course_id: 1,
    client_timestamp: '2024-01-15T10:01:30Z',
    date_created: '2024-01-15T10:01:30Z'
  },
  {
    id: 5,
    event_type: 'Intervention',
    message: 'Great job! Your program works correctly.',
    category: 'Complete',
    label: 'Success Feedback',
    when: '2024-01-15T10:01:35Z',
    subject_id: 1,
    assignment_id: 101,
    course_id: 1,
    client_timestamp: '2024-01-15T10:01:35Z',
    date_created: '2024-01-15T10:01:35Z'
  },
  {
    id: 6,
    event_type: 'X-Submission.LMS',
    message: '100',
    category: 'Submission',
    label: 'Submitted to LMS',
    when: '2024-01-15T10:02:00Z',
    subject_id: 1,
    assignment_id: 101,
    course_id: 1,
    client_timestamp: '2024-01-15T10:02:00Z',
    date_created: '2024-01-15T10:02:00Z'
  }
];
