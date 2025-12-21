/**
 * Unit tests for date formatting utilities
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  formatDuration,
  prettyPrintDateTime,
  prettyPrintDateTimeString,
  prettyPrintDate,
  prettyPrintTime
} from '../../src/utilities/dates';

describe('Date Utilities', () => {
  beforeEach(() => {
    // Mock the current time to 2024-01-15 12:00:00
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('formatDuration', () => {
    it('should return "Never" for null timestamp', () => {
      expect(formatDuration(null)).toBe('Never');
    });

    it('should format seconds correctly', () => {
      const timestamp = '2024-01-15T11:59:30Z'; // 30 seconds ago
      expect(formatDuration(timestamp)).toBe('30 seconds ago');
    });

    it('should format single second correctly', () => {
      const timestamp = '2024-01-15T11:59:59Z'; // 1 second ago
      expect(formatDuration(timestamp)).toBe('1 second ago');
    });

    it('should format minutes correctly', () => {
      const timestamp = '2024-01-15T11:55:00Z'; // 5 minutes ago
      expect(formatDuration(timestamp)).toBe('5 minutes ago');
    });

    it('should format single minute correctly', () => {
      const timestamp = '2024-01-15T11:59:00Z'; // 1 minute ago
      expect(formatDuration(timestamp)).toBe('1 minute ago');
    });

    it('should format hours correctly', () => {
      const timestamp = '2024-01-15T09:00:00Z'; // 3 hours ago
      expect(formatDuration(timestamp)).toBe('3 hours ago');
    });

    it('should format single hour correctly', () => {
      const timestamp = '2024-01-15T11:00:00Z'; // 1 hour ago
      expect(formatDuration(timestamp)).toBe('1 hour ago');
    });

    it('should format days correctly', () => {
      const timestamp = '2024-01-13T12:00:00Z'; // 2 days ago
      expect(formatDuration(timestamp)).toBe('2 days ago');
    });

    it('should format single day correctly', () => {
      const timestamp = '2024-01-14T12:00:00Z'; // 1 day ago
      expect(formatDuration(timestamp)).toBe('1 day ago');
    });

    it('should calculate duration from custom current time', () => {
      const start = '2024-01-15T10:00:00Z';
      const end = '2024-01-15T11:00:00Z';
      expect(formatDuration(start, end)).toBe('1 hour ago');
    });
  });

  describe('prettyPrintDateTime', () => {
    it('should return "Unknown" for null timestamp', () => {
      expect(prettyPrintDateTime(null)).toBe('Unknown');
    });

    it('should format date and time', () => {
      const timestamp = '2024-01-15T10:30:00Z';
      const result = prettyPrintDateTime(timestamp);
      // Result depends on locale, just check it's not empty
      expect(result).toBeTruthy();
      expect(result).not.toBe('Unknown');
    });
  });

  describe('prettyPrintDateTimeString', () => {
    it('should call prettyPrintDateTime', () => {
      const timestamp = '2024-01-15T10:30:00Z';
      expect(prettyPrintDateTimeString(timestamp)).toBe(prettyPrintDateTime(timestamp));
    });
  });

  describe('prettyPrintDate', () => {
    it('should return "Unknown" for null timestamp', () => {
      expect(prettyPrintDate(null)).toBe('Unknown');
    });

    it('should format date without time', () => {
      const timestamp = '2024-01-15T10:30:00Z';
      const result = prettyPrintDate(timestamp);
      expect(result).toBeTruthy();
      expect(result).not.toBe('Unknown');
    });
  });

  describe('prettyPrintTime', () => {
    it('should return "Unknown" for null timestamp', () => {
      expect(prettyPrintTime(null)).toBe('Unknown');
    });

    it('should format time without date', () => {
      const timestamp = '2024-01-15T10:30:00Z';
      const result = prettyPrintTime(timestamp);
      expect(result).toBeTruthy();
      expect(result).not.toBe('Unknown');
    });
  });
});
