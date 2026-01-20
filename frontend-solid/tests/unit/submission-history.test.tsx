/**
 * Integration tests for SubmissionHistory component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import { SubmissionHistory } from '../../src/components/watcher/SubmissionHistory';
import { User } from '../../src/models/user';
import { Assignment } from '../../src/models/assignment';
import { Submission } from '../../src/models/submission';
import { WatchMode } from '../../src/components/watcher/SubmissionState';
import * as ajax from '../../src/services/ajax';
import {
  basicStudentUser,
  simpleAssignment,
  basicSubmission
} from '../fixtures/basic-session';

// Mock the AJAX service
vi.mock('../../src/services/ajax', () => ({
  ajax_post: vi.fn()
}));

describe('SubmissionHistory Component', () => {
  let user: User;
  let assignment: Assignment;
  let submission: Submission;

  beforeEach(() => {
    vi.clearAllMocks();
    user = new User(basicStudentUser);
    assignment = new Assignment(simpleAssignment);
    submission = new Submission(basicSubmission);
  });

  it('should render with empty state', () => {
    render(() => (
      <SubmissionHistory
        user={user}
        assignment={assignment}
      />
    ));

    expect(screen.getByText('Not yet started!')).toBeInTheDocument();
  });

  it('should display user and assignment information', () => {
    render(() => (
      <SubmissionHistory
        user={user}
        assignment={assignment}
      />
    ));

    expect(screen.getByText(/Alice Johnson/)).toBeInTheDocument();
    expect(screen.getAllByText(/Hello World Assignment/)[0]).toBeInTheDocument();
  });

  it('should not show VCR controls when there are no states', () => {
    render(() => (
      <SubmissionHistory
        user={user}
        assignment={assignment}
        submission={submission}
        grouping="None"
      />
    ));

    // When there are no states, VCR controls aren't shown
    const syncButton = screen.queryByText('Sync');
    expect(syncButton).not.toBeInTheDocument();
  });

  it('should hide detailed VCR controls in summary mode', () => {
    render(() => (
      <SubmissionHistory
        user={user}
        assignment={assignment}
        grouping="None"
        defaultWatchMode={WatchMode.SUMMARY}
      />
    ));

    // In summary mode, detailed VCR controls should be hidden
    // (Note: VCR is only shown when there are states)
    const startButton = screen.queryByText('Start');
    expect(startButton).not.toBeInTheDocument();
  });

  it('should handle grouping display when grouping by user', () => {
    render(() => (
      <SubmissionHistory
        user={user}
        assignment={assignment}
        grouping="User"
      />
    ));

    // Should show user name in header
    const headers = screen.getAllByText(/Alice Johnson/);
    expect(headers.length).toBeGreaterThan(0);
  });

  it('should handle grouping display when grouping by assignment', () => {
    render(() => (
      <SubmissionHistory
        user={user}
        assignment={assignment}
        grouping="Assignment"
      />
    ));

    // Should show assignment name in header
    const headers = screen.getAllByText(/Hello World Assignment/);
    expect(headers.length).toBeGreaterThan(0);
  });

  it('should not show grouping header when grouping is None', () => {
    const { container } = render(() => (
      <SubmissionHistory
        user={user}
        assignment={assignment}
        grouping="None"
      />
    ));

    // In the component, h4 is used for grouping header only when grouping is not "None"
    // Check that h4 doesn't exist or is not at the top level
    const topHeaders = container.querySelectorAll(':scope > div > h4');
    expect(topHeaders.length).toBe(0);
  });
});
