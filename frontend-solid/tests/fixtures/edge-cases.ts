/**
 * Test fixture: Edge cases and unusual scenarios
 * Scenario: Empty sessions, runtime errors, view mode changes
 */

import { LogJson } from '../../src/models/log';
import { UserJson } from '../../src/models/user';
import { AssignmentJson } from '../../src/models/assignment';
import { SubmissionJson } from '../../src/models/submission';

export const emptySessionUser: UserJson = {
  id: 6,
  first_name: 'Frank',
  last_name: 'Miller',
  email: 'frank.miller@example.edu'
};

export const emptyAssignment: AssignmentJson = {
  id: 106,
  name: 'Empty Assignment',
  body: 'This assignment has no submissions yet'
};

export const edgeCaseUser: UserJson = {
  id: 7,
  first_name: 'Grace',
  last_name: 'Hopper',
  email: 'grace.hopper@example.edu'
};

export const complexAssignment: AssignmentJson = {
  id: 107,
  name: 'Runtime Error Practice',
  body: 'Handle runtime errors properly'
};

export const edgeCaseSubmission: SubmissionJson = {
  id: 1007,
  user_id: 7,
  assignment_id: 107,
  course_id: 1,
  code: 'x = 10\ny = 0\ntry:\n    print(x / y)\nexcept:\n    print("Error!")',
  correct: true,
  score: 90
};

// Empty session - student just opened but didn't do anything
export const emptySessionLogs: LogJson[] = [
  {
    id: 40,
    event_type: 'Session.Start',
    message: '',
    category: 'Session',
    label: 'Session Started',
    when: '2024-01-15T16:00:00Z',
    subject_id: 6,
    assignment_id: 106,
    course_id: 1,
    client_timestamp: '2024-01-15T16:00:00Z',
    date_created: '2024-01-15T16:00:00Z'
  }
];

// Session with runtime errors and view mode changes
export const edgeCaseSessionLogs: LogJson[] = [
  {
    id: 50,
    event_type: 'Session.Start',
    message: '',
    category: 'Session',
    label: 'Session Started',
    when: '2024-01-15T11:00:00Z',
    subject_id: 7,
    assignment_id: 107,
    course_id: 1,
    client_timestamp: '2024-01-15T11:00:00Z',
    date_created: '2024-01-15T11:00:00Z'
  },
  {
    id: 51,
    event_type: 'X-View.Change',
    message: 'blocks',
    category: 'View',
    label: 'View Changed',
    when: '2024-01-15T11:00:30Z',
    subject_id: 7,
    assignment_id: 107,
    course_id: 1,
    client_timestamp: '2024-01-15T11:00:30Z',
    date_created: '2024-01-15T11:00:30Z'
  },
  {
    id: 52,
    event_type: 'File.Create',
    message: 'x = 10\ny = 0\nprint(x / y)',
    category: 'File',
    label: 'File Created',
    when: '2024-01-15T11:01:00Z',
    subject_id: 7,
    assignment_id: 107,
    course_id: 1,
    client_timestamp: '2024-01-15T11:01:00Z',
    date_created: '2024-01-15T11:01:00Z'
  },
  {
    id: 53,
    event_type: 'Run.Program',
    message: 'ZeroDivisionError: division by zero',
    category: 'ProgramErrorOutput',
    label: 'Runtime Error',
    when: '2024-01-15T11:01:30Z',
    subject_id: 7,
    assignment_id: 107,
    course_id: 1,
    client_timestamp: '2024-01-15T11:01:30Z',
    date_created: '2024-01-15T11:01:30Z'
  },
  {
    id: 54,
    event_type: 'Intervention',
    message: 'Be careful with division by zero! Try using a try-except block.',
    category: 'Hint',
    label: 'Feedback',
    when: '2024-01-15T11:01:35Z',
    subject_id: 7,
    assignment_id: 107,
    course_id: 1,
    client_timestamp: '2024-01-15T11:01:35Z',
    date_created: '2024-01-15T11:01:35Z'
  },
  {
    id: 55,
    event_type: 'X-View.Change',
    message: 'text',
    category: 'View',
    label: 'View Changed',
    when: '2024-01-15T11:02:00Z',
    subject_id: 7,
    assignment_id: 107,
    course_id: 1,
    client_timestamp: '2024-01-15T11:02:00Z',
    date_created: '2024-01-15T11:02:00Z'
  },
  {
    id: 56,
    event_type: 'File.Edit',
    message: 'x = 10\ny = 0\ntry:\n    print(x / y)\nexcept:\n    print("Error!")',
    category: 'File',
    label: 'File Edited',
    when: '2024-01-15T11:03:00Z',
    subject_id: 7,
    assignment_id: 107,
    course_id: 1,
    client_timestamp: '2024-01-15T11:03:00Z',
    date_created: '2024-01-15T11:03:00Z'
  },
  {
    id: 57,
    event_type: 'Run.Program',
    message: '{"output": "[{\\"type\\": \\"text\\", \\"contents\\": \\"Error!\\"}]", "errors": "[]"}',
    category: 'ProgramOutput',
    label: 'Program Executed',
    when: '2024-01-15T11:03:30Z',
    subject_id: 7,
    assignment_id: 107,
    course_id: 1,
    client_timestamp: '2024-01-15T11:03:30Z',
    date_created: '2024-01-15T11:03:30Z'
  },
  {
    id: 58,
    event_type: 'Intervention',
    message: 'Good job handling the error! Your exception handling works.',
    category: 'Complete',
    label: 'Success Feedback',
    when: '2024-01-15T11:03:35Z',
    subject_id: 7,
    assignment_id: 107,
    course_id: 1,
    client_timestamp: '2024-01-15T11:03:35Z',
    date_created: '2024-01-15T11:03:35Z'
  },
  {
    id: 59,
    event_type: 'X-Submission.LMS',
    message: '90',
    category: 'Submission',
    label: 'Submitted to LMS',
    when: '2024-01-15T11:04:00Z',
    subject_id: 7,
    assignment_id: 107,
    course_id: 1,
    client_timestamp: '2024-01-15T11:04:00Z',
    date_created: '2024-01-15T11:04:00Z'
  }
];

// Session with rapid edits (multiple edits in quick succession)
export const rapidEditUser: UserJson = {
  id: 8,
  first_name: 'Henry',
  last_name: 'Ford',
  email: 'henry.ford@example.edu'
};

export const rapidEditLogs: LogJson[] = [
  {
    id: 60,
    event_type: 'Session.Start',
    message: '',
    category: 'Session',
    label: 'Session Started',
    when: '2024-01-15T13:00:00Z',
    subject_id: 8,
    assignment_id: 101,
    course_id: 1,
    client_timestamp: '2024-01-15T13:00:00Z',
    date_created: '2024-01-15T13:00:00Z'
  },
  {
    id: 61,
    event_type: 'File.Create',
    message: 'p',
    category: 'File',
    label: 'File Created',
    when: '2024-01-15T13:00:01Z',
    subject_id: 8,
    assignment_id: 101,
    course_id: 1,
    client_timestamp: '2024-01-15T13:00:01Z',
    date_created: '2024-01-15T13:00:01Z'
  },
  {
    id: 62,
    event_type: 'File.Edit',
    message: 'pr',
    category: 'File',
    label: 'File Edited',
    when: '2024-01-15T13:00:02Z',
    subject_id: 8,
    assignment_id: 101,
    course_id: 1,
    client_timestamp: '2024-01-15T13:00:02Z',
    date_created: '2024-01-15T13:00:02Z'
  },
  {
    id: 63,
    event_type: 'File.Edit',
    message: 'pri',
    category: 'File',
    label: 'File Edited',
    when: '2024-01-15T13:00:03Z',
    subject_id: 8,
    assignment_id: 101,
    course_id: 1,
    client_timestamp: '2024-01-15T13:00:03Z',
    date_created: '2024-01-15T13:00:03Z'
  },
  {
    id: 64,
    event_type: 'File.Edit',
    message: 'prin',
    category: 'File',
    label: 'File Edited',
    when: '2024-01-15T13:00:04Z',
    subject_id: 8,
    assignment_id: 101,
    course_id: 1,
    client_timestamp: '2024-01-15T13:00:04Z',
    date_created: '2024-01-15T13:00:04Z'
  },
  {
    id: 65,
    event_type: 'File.Edit',
    message: 'print',
    category: 'File',
    label: 'File Edited',
    when: '2024-01-15T13:00:05Z',
    subject_id: 8,
    assignment_id: 101,
    course_id: 1,
    client_timestamp: '2024-01-15T13:00:05Z',
    date_created: '2024-01-15T13:00:05Z'
  },
  {
    id: 66,
    event_type: 'File.Edit',
    message: 'print("Hello")',
    category: 'File',
    label: 'File Edited',
    when: '2024-01-15T13:00:10Z',
    subject_id: 8,
    assignment_id: 101,
    course_id: 1,
    client_timestamp: '2024-01-15T13:00:10Z',
    date_created: '2024-01-15T13:00:10Z'
  },
  {
    id: 67,
    event_type: 'Run.Program',
    message: '{"output": "[{\\"type\\": \\"text\\", \\"contents\\": \\"Hello\\"}]", "errors": "[]"}',
    category: 'ProgramOutput',
    label: 'Program Executed',
    when: '2024-01-15T13:00:15Z',
    subject_id: 8,
    assignment_id: 101,
    course_id: 1,
    client_timestamp: '2024-01-15T13:00:15Z',
    date_created: '2024-01-15T13:00:15Z'
  }
];
