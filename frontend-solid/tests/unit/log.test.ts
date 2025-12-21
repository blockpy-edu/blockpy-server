/**
 * Unit tests for the Log model
 */

import { describe, it, expect } from 'vitest';
import { Log, REMAP_EVENT_TYPES } from '../../src/models/log';
import { basicSessionLogs } from '../fixtures/basic-session';

describe('Log Model', () => {
  it('should create a Log from JSON data', () => {
    const logData = basicSessionLogs[0];
    const log = new Log(logData);

    expect(log.id).toBe(1);
    expect(log.eventType()).toBe('Session.Start');
    expect(log.message()).toBe('');
    expect(log.category()).toBe('Session');
    expect(log.label()).toBe('Session Started');
    expect(log.when()).toBe('2024-01-15T10:00:00Z');
    expect(log.subjectId()).toBe(1);
    expect(log.assignmentId()).toBe(101);
    expect(log.courseId()).toBe(1);
  });

  it('should identify edit events correctly', () => {
    const editLog = new Log(basicSessionLogs[2]); // File.Edit event
    const startLog = new Log(basicSessionLogs[0]); // Session.Start event

    expect(editLog.isEditEvent()).toBe(true);
    expect(startLog.isEditEvent()).toBe(false);
  });

  it('should generate correct submission key', () => {
    const log = new Log(basicSessionLogs[0]);
    const expectedKey = '1-101-1'; // course_id-assignment_id-subject_id

    expect(log.getAsSubmissionKey()).toBe(expectedKey);
  });

  it('should handle optional timestamp fields', () => {
    const logData = {
      ...basicSessionLogs[0],
      client_timestamp: undefined,
      date_created: undefined
    };
    const log = new Log(logData);

    expect(log.clientTimestamp()).toBeUndefined();
    expect(log.dateCreated()).toBeUndefined();
  });

  it('should remap event types correctly', () => {
    expect(REMAP_EVENT_TYPES['File.Create']).toBe('Created File');
    expect(REMAP_EVENT_TYPES['File.Edit']).toBe('Edited Code');
    expect(REMAP_EVENT_TYPES['Session.Start']).toBe('Started Session');
    expect(REMAP_EVENT_TYPES['Compile']).toBe('Compiled');
    expect(REMAP_EVENT_TYPES['Run.Program']).toBe('Ran Program');
    expect(REMAP_EVENT_TYPES['Compile.Error']).toBe('Compilation Error');
    expect(REMAP_EVENT_TYPES['Intervention']).toBe('Feedback');
    expect(REMAP_EVENT_TYPES['X-View.Change']).toBe('Changed View');
    expect(REMAP_EVENT_TYPES['X-Submission.LMS']).toBe('Submitted to LMS');
  });
});
