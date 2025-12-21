/**
 * Unit tests for SubmissionState
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SubmissionState, WatchMode, FeedbackMode } from '../../src/components/watcher/SubmissionState';
import { Log } from '../../src/models/log';
import {
  basicSessionLogs,
} from '../fixtures/basic-session';
import {
  errorSessionLogs
} from '../fixtures/error-session';
import {
  edgeCaseSessionLogs
} from '../fixtures/edge-cases';

describe('SubmissionState', () => {
  describe('constructor and state copying', () => {
    it('should initialize with null previous state', () => {
      const log = new Log(basicSessionLogs[0]);
      const state = new SubmissionState(null, log);

      expect(state.code).toBe('');
      expect(state.friendly).toBe('Started Session');
      expect(state.feedback).toBe('Not yet executed');
      expect(state.system).toContain('New Session'); // System message is added
      expect(state.completed).toBe(false);
      expect(state.score).toBe(0);
    });

    it('should copy state from previous state', () => {
      const log1 = new Log(basicSessionLogs[1]); // File.Create
      const state1 = new SubmissionState(null, log1);

      const log2 = new Log(basicSessionLogs[2]); // File.Edit
      const state2 = new SubmissionState(state1, log2);

      expect(state2.code).toBe('print("Hello, World!")');
      expect(state2.lastEdit).toBe('2024-01-15T10:01:00Z');
    });
  });

  describe('event handling', () => {
    it('should handle Session.Start event', () => {
      const log = new Log(basicSessionLogs[0]);
      const state = new SubmissionState(null, log);

      expect(state.lastOpened).toBe('2024-01-15T10:00:00Z');
      expect(state.system).toContain('New Session');
    });

    it('should handle File.Create event', () => {
      const log = new Log(basicSessionLogs[1]);
      const state = new SubmissionState(null, log);

      expect(state.code).toBe('print("Hello")');
      expect(state.lastEdit).toBe('2024-01-15T10:00:30Z');
    });

    it('should handle File.Edit event', () => {
      const log = new Log(basicSessionLogs[2]);
      const state = new SubmissionState(null, log);

      expect(state.code).toBe('print("Hello, World!")');
      expect(state.lastEdit).toBe('2024-01-15T10:01:00Z');
      expect(state.system).toContain('Edited code');
    });

    it('should handle Run.Program event with output', () => {
      const log = new Log(basicSessionLogs[3]);
      const state = new SubmissionState(null, log);

      expect(state.lastRan).toBe('2024-01-15T10:01:30Z');
      expect(state.system).toContain('Execution Output');
    });

    it('should handle Run.Program event with runtime error', () => {
      const log = new Log(edgeCaseSessionLogs[3]); // Runtime error
      const state = new SubmissionState(null, log);

      expect(state.lastRan).toBe('2024-01-15T11:01:30Z');
      expect(state.system).toContain('Runtime Error');
      expect(state.system).toContain('ZeroDivisionError');
    });

    it('should handle Compile.Error event', () => {
      const log = new Log(errorSessionLogs[2]); // Compile error
      const state = new SubmissionState(null, log);

      expect(state.system).toContain('Compiler Error');
      expect(state.system).toContain('SyntaxError');
    });

    it('should handle Intervention event with Complete category', () => {
      const log = new Log(basicSessionLogs[4]);
      const state = new SubmissionState(null, log);

      expect(state.completed).toBe(true);
      expect(state.feedback).toContain('Great job');
    });

    it('should handle Intervention event with Incomplete category', () => {
      const log = new Log(errorSessionLogs[5]); // Incomplete feedback
      const state = new SubmissionState(null, log);

      expect(state.completed).toBe(false);
      expect(state.feedback).toContain('Almost there');
    });

    it('should handle X-View.Change event', () => {
      const log = new Log(edgeCaseSessionLogs[1]); // View change to blocks
      const state = new SubmissionState(null, log);

      expect(state.mode).toBe('blocks');
      expect(state.system).toContain('Changed Editing Mode');
    });

    it('should handle X-Submission.LMS event', () => {
      const log = new Log(basicSessionLogs[5]);
      const state = new SubmissionState(null, log);

      expect(state.score).toBe(100);
      expect(state.system).toContain('Submitted Score');
    });
  });

  describe('pretty print methods', () => {
    it('should format pretty time', () => {
      const log = new Log(basicSessionLogs[0]);
      const state = new SubmissionState(null, log);
      const prettyTime = state.getPrettyTime();

      expect(prettyTime).toBeTruthy();
      expect(typeof prettyTime).toBe('string');
    });

    it('should format pretty last edit in summary mode', () => {
      const log = new Log(basicSessionLogs[2]);
      const state = new SubmissionState(null, log);
      const duration = state.getPrettyLastEdit(WatchMode.SUMMARY);

      expect(duration).toBeTruthy();
      expect(typeof duration).toBe('string');
    });

    it('should format pretty last ran in full mode', () => {
      const log = new Log(basicSessionLogs[3]);
      const state = new SubmissionState(null, log);
      const duration = state.getPrettyLastRan(WatchMode.FULL);

      expect(duration).toBeTruthy();
      expect(typeof duration).toBe('string');
    });

    it('should return "Never" for null timestamps', () => {
      const log = new Log(basicSessionLogs[0]); // No edit yet
      const state = new SubmissionState(null, log);
      const duration = state.getPrettyLastEdit();

      expect(duration).toBe('Never');
    });
  });

  describe('FeedbackMode enum', () => {
    it('should have correct feedback mode values', () => {
      expect(FeedbackMode.FEEDBACK).toBe('Feedback');
      expect(FeedbackMode.SYSTEM).toBe('System');
      expect(FeedbackMode.BOTH).toBe('Both');
      expect(FeedbackMode.HIDE).toBe('Hidden');
    });
  });

  describe('WatchMode enum', () => {
    it('should have correct watch mode values', () => {
      expect(WatchMode.SUMMARY).toBe('SUMMARY');
      expect(WatchMode.FULL).toBe('FULL');
    });
  });
});
