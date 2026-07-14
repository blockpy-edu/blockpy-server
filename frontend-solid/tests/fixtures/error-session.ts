/**
 * Test fixture: Student with compilation and runtime errors
 * Scenario: Student makes several attempts, encounters errors, finally succeeds
 */

import { LogJson } from '../../src/models/log';
import { UserJson } from '../../src/models/user';
import { AssignmentJson } from '../../src/models/assignment';
import { SubmissionJson } from '../../src/models/submission';

export const strugglingStudentUser: UserJson = {
  id: 2,
  first_name: 'Bob',
  last_name: 'Smith',
  email: 'bob.smith@example.edu'
};

export const loopAssignment: AssignmentJson = {
  id: 102,
  name: 'For Loop Practice',
  body: 'Write a program that prints numbers 1 through 10'
};

export const errorSubmission: SubmissionJson = {
  id: 1002,
  user_id: 2,
  assignment_id: 102,
  course_id: 1,
  code: 'for i in range(1, 11):\n    print(i)',
  correct: true,
  score: 85
};

export const errorSessionLogs: LogJson[] = [
  {
    id: 10,
    event_type: 'Session.Start',
    message: '',
    category: 'Session',
    label: 'Session Started',
    when: '2024-01-15T14:00:00Z',
    subject_id: 2,
    assignment_id: 102,
    course_id: 1,
    client_timestamp: '2024-01-15T14:00:00Z',
    date_created: '2024-01-15T14:00:00Z'
  },
  {
    id: 11,
    event_type: 'File.Create',
    message: 'for i in range(1, 10)\n    print(i)',
    category: 'File',
    label: 'File Created',
    when: '2024-01-15T14:02:00Z',
    subject_id: 2,
    assignment_id: 102,
    course_id: 1,
    client_timestamp: '2024-01-15T14:02:00Z',
    date_created: '2024-01-15T14:02:00Z'
  },
  {
    id: 12,
    event_type: 'Compile.Error',
    message: 'SyntaxError: invalid syntax on line 1 (missing colon)',
    category: 'SyntaxError',
    label: 'Syntax Error',
    when: '2024-01-15T14:02:15Z',
    subject_id: 2,
    assignment_id: 102,
    course_id: 1,
    client_timestamp: '2024-01-15T14:02:15Z',
    date_created: '2024-01-15T14:02:15Z'
  },
  {
    id: 13,
    event_type: 'File.Edit',
    message: 'for i in range(1, 10):\n    print(i)',
    category: 'File',
    label: 'File Edited',
    when: '2024-01-15T14:03:00Z',
    subject_id: 2,
    assignment_id: 102,
    course_id: 1,
    client_timestamp: '2024-01-15T14:03:00Z',
    date_created: '2024-01-15T14:03:00Z'
  },
  {
    id: 14,
    event_type: 'Run.Program',
    message: '{"output": "[{\\"type\\": \\"text\\", \\"contents\\": \\"1\\\\n2\\\\n3\\\\n4\\\\n5\\\\n6\\\\n7\\\\n8\\\\n9\\"}]", "errors": "[]"}',
    category: 'ProgramOutput',
    label: 'Program Executed',
    when: '2024-01-15T14:03:30Z',
    subject_id: 2,
    assignment_id: 102,
    course_id: 1,
    client_timestamp: '2024-01-15T14:03:30Z',
    date_created: '2024-01-15T14:03:30Z'
  },
  {
    id: 15,
    event_type: 'Intervention',
    message: 'Almost there! You printed 1-9, but the assignment asks for 1-10.',
    category: 'Incomplete',
    label: 'Feedback',
    when: '2024-01-15T14:03:35Z',
    subject_id: 2,
    assignment_id: 102,
    course_id: 1,
    client_timestamp: '2024-01-15T14:03:35Z',
    date_created: '2024-01-15T14:03:35Z'
  },
  {
    id: 16,
    event_type: 'File.Edit',
    message: 'for i in range(1, 11):\n    print(i)',
    category: 'File',
    label: 'File Edited',
    when: '2024-01-15T14:05:00Z',
    subject_id: 2,
    assignment_id: 102,
    course_id: 1,
    client_timestamp: '2024-01-15T14:05:00Z',
    date_created: '2024-01-15T14:05:00Z'
  },
  {
    id: 17,
    event_type: 'Run.Program',
    message: '{"output": "[{\\"type\\": \\"text\\", \\"contents\\": \\"1\\\\n2\\\\n3\\\\n4\\\\n5\\\\n6\\\\n7\\\\n8\\\\n9\\\\n10\\"}]", "errors": "[]"}',
    category: 'ProgramOutput',
    label: 'Program Executed',
    when: '2024-01-15T14:05:30Z',
    subject_id: 2,
    assignment_id: 102,
    course_id: 1,
    client_timestamp: '2024-01-15T14:05:30Z',
    date_created: '2024-01-15T14:05:30Z'
  },
  {
    id: 18,
    event_type: 'Intervention',
    message: 'Perfect! Your program now works correctly.',
    category: 'Complete',
    label: 'Success Feedback',
    when: '2024-01-15T14:05:35Z',
    subject_id: 2,
    assignment_id: 102,
    course_id: 1,
    client_timestamp: '2024-01-15T14:05:35Z',
    date_created: '2024-01-15T14:05:35Z'
  },
  {
    id: 19,
    event_type: 'X-Submission.LMS',
    message: '85',
    category: 'Submission',
    label: 'Submitted to LMS',
    when: '2024-01-15T14:06:00Z',
    subject_id: 2,
    assignment_id: 102,
    course_id: 1,
    client_timestamp: '2024-01-15T14:06:00Z',
    date_created: '2024-01-15T14:06:00Z'
  }
];
