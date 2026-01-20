/**
 * Unit tests for User, Assignment, and Submission models
 */

import { describe, it, expect } from 'vitest';
import { User } from '../../src/models/user';
import { Assignment } from '../../src/models/assignment';
import { Submission } from '../../src/models/submission';
import {
  basicStudentUser,
  simpleAssignment,
  basicSubmission
} from '../fixtures/basic-session';

describe('User Model', () => {
  it('should create a User from JSON data', () => {
    const user = new User(basicStudentUser);

    expect(user.id).toBe(1);
    expect(user.firstName()).toBe('Alice');
    expect(user.lastName()).toBe('Johnson');
    expect(user.email()).toBe('alice.johnson@example.edu');
  });

  it('should generate correct title', () => {
    const user = new User(basicStudentUser);
    expect(user.title()).toBe('Alice Johnson');
  });

  it('should handle users with different names', () => {
    const userWithShortName = new User({
      id: 2,
      first_name: 'Jo',
      last_name: 'Li',
      email: 'jo.li@test.edu'
    });

    expect(userWithShortName.title()).toBe('Jo Li');
  });
});

describe('Assignment Model', () => {
  it('should create an Assignment from JSON data', () => {
    const assignment = new Assignment(simpleAssignment);

    expect(assignment.id).toBe(101);
    expect(assignment.name()).toBe('Hello World Assignment');
    expect(assignment.body()).toBe('Write a program that prints "Hello, World!"');
  });

  it('should use name as title', () => {
    const assignment = new Assignment(simpleAssignment);
    expect(assignment.title()).toBe('Hello World Assignment');
  });

  it('should handle assignment without body', () => {
    const assignmentWithoutBody = new Assignment({
      id: 999,
      name: 'Test Assignment'
    });

    expect(assignmentWithoutBody.body()).toBeUndefined();
    expect(assignmentWithoutBody.title()).toBe('Test Assignment');
  });
});

describe('Submission Model', () => {
  it('should create a Submission from JSON data', () => {
    const submission = new Submission(basicSubmission);

    expect(submission.id()).toBe(1001);
    expect(submission.userId()).toBe(1);
    expect(submission.assignmentId()).toBe(101);
    expect(submission.courseId()).toBe(1);
    expect(submission.code()).toBe('print("Hello, World!")');
    expect(submission.correct()).toBe(true);
    expect(submission.score()).toBe(100);
  });

  it('should generate correct submission key', () => {
    const submission = new Submission(basicSubmission);
    const expectedKey = '1-101-1'; // course_id-assignment_id-user_id

    expect(submission.getAsSubmissionKey()).toBe(expectedKey);
  });

  it('should update from JSON data', () => {
    const submission = new Submission(basicSubmission);

    const updatedData = {
      ...basicSubmission,
      code: 'print("Updated!")',
      score: 95,
      correct: true
    };

    submission.fromJson(updatedData);

    expect(submission.code()).toBe('print("Updated!")');
    expect(submission.score()).toBe(95);
    expect(submission.correct()).toBe(true);
  });

  it('should handle submission with missing optional fields', () => {
    const minimalSubmission = new Submission({
      id: 1,
      user_id: 1,
      assignment_id: 1,
      course_id: 1
    });

    expect(minimalSubmission.code()).toBeUndefined();
    expect(minimalSubmission.correct()).toBeUndefined();
    expect(minimalSubmission.score()).toBeUndefined();
  });
});
