/**
 * Test fixture: Complex session with multiple students and assignments
 * Scenario: Multiple students working on different assignments
 */

import { LogJson } from '../../src/models/log';
import { UserJson } from '../../src/models/user';
import { AssignmentJson } from '../../src/models/assignment';
import { SubmissionJson } from '../../src/models/submission';

export const multipleStudents: UserJson[] = [
  {
    id: 3,
    first_name: 'Charlie',
    last_name: 'Brown',
    email: 'charlie.brown@example.edu'
  },
  {
    id: 4,
    first_name: 'Diana',
    last_name: 'Prince',
    email: 'diana.prince@example.edu'
  },
  {
    id: 5,
    first_name: 'Eve',
    last_name: 'Williams',
    email: 'eve.williams@example.edu'
  }
];

export const multipleAssignments: AssignmentJson[] = [
  {
    id: 103,
    name: 'Variables and Types',
    body: 'Create variables of different types and print them'
  },
  {
    id: 104,
    name: 'Functions',
    body: 'Write a function that calculates the area of a circle'
  },
  {
    id: 105,
    name: 'Lists and Loops',
    body: 'Create a list and iterate through it'
  }
];

export const multipleSubmissions: SubmissionJson[] = [
  {
    id: 1003,
    user_id: 3,
    assignment_id: 103,
    course_id: 1,
    code: 'x = 5\ny = "hello"\nprint(x, y)',
    correct: true,
    score: 100
  },
  {
    id: 1004,
    user_id: 3,
    assignment_id: 104,
    course_id: 1,
    code: 'def area(r):\n    return 3.14 * r * r',
    correct: false,
    score: 60
  },
  {
    id: 1005,
    user_id: 4,
    assignment_id: 103,
    course_id: 1,
    code: 'name = "Diana"\nage = 20\nprint(name, age)',
    correct: true,
    score: 95
  },
  {
    id: 1006,
    user_id: 5,
    assignment_id: 105,
    course_id: 1,
    code: 'items = [1, 2, 3]\nfor i in items:\n    print(i)',
    correct: true,
    score: 100
  }
];

export const complexSessionLogs: LogJson[] = [
  // Charlie working on Variables assignment
  {
    id: 20,
    event_type: 'Session.Start',
    message: '',
    category: 'Session',
    label: 'Session Started',
    when: '2024-01-15T09:00:00Z',
    subject_id: 3,
    assignment_id: 103,
    course_id: 1,
    client_timestamp: '2024-01-15T09:00:00Z',
    date_created: '2024-01-15T09:00:00Z'
  },
  {
    id: 21,
    event_type: 'File.Create',
    message: 'x = 5',
    category: 'File',
    label: 'File Created',
    when: '2024-01-15T09:01:00Z',
    subject_id: 3,
    assignment_id: 103,
    course_id: 1,
    client_timestamp: '2024-01-15T09:01:00Z',
    date_created: '2024-01-15T09:01:00Z'
  },
  {
    id: 22,
    event_type: 'File.Edit',
    message: 'x = 5\ny = "hello"',
    category: 'File',
    label: 'File Edited',
    when: '2024-01-15T09:02:00Z',
    subject_id: 3,
    assignment_id: 103,
    course_id: 1,
    client_timestamp: '2024-01-15T09:02:00Z',
    date_created: '2024-01-15T09:02:00Z'
  },
  {
    id: 23,
    event_type: 'File.Edit',
    message: 'x = 5\ny = "hello"\nprint(x, y)',
    category: 'File',
    label: 'File Edited',
    when: '2024-01-15T09:03:00Z',
    subject_id: 3,
    assignment_id: 103,
    course_id: 1,
    client_timestamp: '2024-01-15T09:03:00Z',
    date_created: '2024-01-15T09:03:00Z'
  },
  {
    id: 24,
    event_type: 'Run.Program',
    message: '{"output": "[{\\"type\\": \\"text\\", \\"contents\\": \\"5 hello\\"}]", "errors": "[]"}',
    category: 'ProgramOutput',
    label: 'Program Executed',
    when: '2024-01-15T09:03:30Z',
    subject_id: 3,
    assignment_id: 103,
    course_id: 1,
    client_timestamp: '2024-01-15T09:03:30Z',
    date_created: '2024-01-15T09:03:30Z'
  },
  // Diana working on same assignment
  {
    id: 25,
    event_type: 'Session.Start',
    message: '',
    category: 'Session',
    label: 'Session Started',
    when: '2024-01-15T09:05:00Z',
    subject_id: 4,
    assignment_id: 103,
    course_id: 1,
    client_timestamp: '2024-01-15T09:05:00Z',
    date_created: '2024-01-15T09:05:00Z'
  },
  {
    id: 26,
    event_type: 'File.Create',
    message: 'name = "Diana"\nage = 20',
    category: 'File',
    label: 'File Created',
    when: '2024-01-15T09:06:00Z',
    subject_id: 4,
    assignment_id: 103,
    course_id: 1,
    client_timestamp: '2024-01-15T09:06:00Z',
    date_created: '2024-01-15T09:06:00Z'
  },
  {
    id: 27,
    event_type: 'File.Edit',
    message: 'name = "Diana"\nage = 20\nprint(name, age)',
    category: 'File',
    label: 'File Edited',
    when: '2024-01-15T09:07:00Z',
    subject_id: 4,
    assignment_id: 103,
    course_id: 1,
    client_timestamp: '2024-01-15T09:07:00Z',
    date_created: '2024-01-15T09:07:00Z'
  },
  {
    id: 28,
    event_type: 'Run.Program',
    message: '{"output": "[{\\"type\\": \\"text\\", \\"contents\\": \\"Diana 20\\"}]", "errors": "[]"}',
    category: 'ProgramOutput',
    label: 'Program Executed',
    when: '2024-01-15T09:07:30Z',
    subject_id: 4,
    assignment_id: 103,
    course_id: 1,
    client_timestamp: '2024-01-15T09:07:30Z',
    date_created: '2024-01-15T09:07:30Z'
  },
  // Eve working on Lists assignment
  {
    id: 29,
    event_type: 'Session.Start',
    message: '',
    category: 'Session',
    label: 'Session Started',
    when: '2024-01-15T09:10:00Z',
    subject_id: 5,
    assignment_id: 105,
    course_id: 1,
    client_timestamp: '2024-01-15T09:10:00Z',
    date_created: '2024-01-15T09:10:00Z'
  },
  {
    id: 30,
    event_type: 'File.Create',
    message: 'items = [1, 2, 3]',
    category: 'File',
    label: 'File Created',
    when: '2024-01-15T09:11:00Z',
    subject_id: 5,
    assignment_id: 105,
    course_id: 1,
    client_timestamp: '2024-01-15T09:11:00Z',
    date_created: '2024-01-15T09:11:00Z'
  },
  {
    id: 31,
    event_type: 'File.Edit',
    message: 'items = [1, 2, 3]\nfor i in items:\n    print(i)',
    category: 'File',
    label: 'File Edited',
    when: '2024-01-15T09:12:00Z',
    subject_id: 5,
    assignment_id: 105,
    course_id: 1,
    client_timestamp: '2024-01-15T09:12:00Z',
    date_created: '2024-01-15T09:12:00Z'
  },
  {
    id: 32,
    event_type: 'Run.Program',
    message: '{"output": "[{\\"type\\": \\"text\\", \\"contents\\": \\"1\\\\n2\\\\n3\\"}]", "errors": "[]"}',
    category: 'ProgramOutput',
    label: 'Program Executed',
    when: '2024-01-15T09:12:30Z',
    subject_id: 5,
    assignment_id: 105,
    course_id: 1,
    client_timestamp: '2024-01-15T09:12:30Z',
    date_created: '2024-01-15T09:12:30Z'
  },
  {
    id: 33,
    event_type: 'Intervention',
    message: 'Excellent work! Your list iteration is perfect.',
    category: 'Complete',
    label: 'Success Feedback',
    when: '2024-01-15T09:12:35Z',
    subject_id: 5,
    assignment_id: 105,
    course_id: 1,
    client_timestamp: '2024-01-15T09:12:35Z',
    date_created: '2024-01-15T09:12:35Z'
  }
];
