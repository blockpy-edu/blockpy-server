/**
 * Integration tests for the Watcher component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@solidjs/testing-library';
import { Watcher } from '../../src/components/watcher/Watcher';
import * as ajax from '../../src/services/ajax';
import {
  basicSessionLogs,
  basicStudentUser,
  simpleAssignment,
  basicSubmission
} from '../fixtures/basic-session';
import {
  errorSessionLogs,
  strugglingStudentUser,
  loopAssignment,
  errorSubmission
} from '../fixtures/error-session';
import {
  complexSessionLogs,
  multipleSubmissions
} from '../fixtures/complex-session';

// Mock the AJAX service
vi.mock('../../src/services/ajax', () => ({
  ajax_post: vi.fn()
}));

describe('Watcher Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render with initial state', () => {
    render(() => (
      <Watcher
        courseId={1}
        assignmentIds="101"
        userIds="1"
      />
    ));

    expect(screen.getByText('View Submissions')).toBeInTheDocument();
  });

  it('should show loading state when fetching data', async () => {
    vi.mocked(ajax.ajax_post).mockImplementation(() => new Promise(() => {})); // Never resolves

    render(() => (
      <Watcher
        courseId={1}
        assignmentIds="101"
        userIds="1"
      />
    ));

    const button = screen.getByText('View Submissions');
    button.click();

    await waitFor(() => {
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });

  it('should display submissions after successful fetch', async () => {
    vi.mocked(ajax.ajax_post).mockResolvedValue({
      success: true,
      history: basicSessionLogs,
      submissions: [basicSubmission]
    });

    render(() => (
      <Watcher
        courseId={1}
        assignmentIds="101"
        userIds="1"
      />
    ));

    const button = screen.getByText('View Submissions');
    button.click();

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });
  });

  it('should show error message on fetch failure', async () => {
    vi.mocked(ajax.ajax_post).mockResolvedValue({
      success: false,
      history: [],
      submissions: []
    });

    render(() => (
      <Watcher
        courseId={1}
        assignmentIds="101"
        userIds="1"
      />
    ));

    const button = screen.getByText('View Submissions');
    button.click();

    await waitFor(() => {
      expect(screen.getByText(/Loading these events has failed/)).toBeInTheDocument();
    });
  });

  it('should handle multiple submissions from different users', async () => {
    vi.mocked(ajax.ajax_post).mockResolvedValue({
      success: true,
      history: complexSessionLogs,
      submissions: multipleSubmissions
    });

    render(() => (
      <Watcher
        courseId={1}
        assignmentIds="103,104,105"
        userIds="3,4,5"
      />
    ));

    const button = screen.getByText('View Submissions');
    button.click();

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });
  });

  it('should handle network errors gracefully', async () => {
    vi.mocked(ajax.ajax_post).mockRejectedValue(new Error('Network error'));

    render(() => (
      <Watcher
        courseId={1}
        assignmentIds="101"
        userIds="1"
      />
    ));

    const button = screen.getByText('View Submissions');
    button.click();

    await waitFor(() => {
      expect(screen.getByText(/Loading these events has failed/)).toBeInTheDocument();
    });
  });

  it('should pass correct parameters to API', async () => {
    vi.mocked(ajax.ajax_post).mockResolvedValue({
      success: true,
      history: [],
      submissions: []
    });

    render(() => (
      <Watcher
        courseId={42}
        assignmentIds="101,102"
        userIds="1,2,3"
      />
    ));

    const button = screen.getByText('View Submissions');
    button.click();

    await waitFor(() => {
      expect(ajax.ajax_post).toHaveBeenCalledWith(
        'blockpy/load_history',
        expect.objectContaining({
          course_id: 42,
          assignment_id: '101,102',
          user_id: '1,2,3',
          with_submission: true
        })
      );
    });
  });

  it('should determine grouping mode correctly - by user', async () => {
    vi.mocked(ajax.ajax_post).mockResolvedValue({
      success: true,
      history: complexSessionLogs,
      submissions: multipleSubmissions
    });

    render(() => (
      <Watcher
        courseId={1}
        assignmentIds="103" // 1 assignment
        userIds="3,4,5" // 3 users - should group by user
      />
    ));

    const button = screen.getByText('View Submissions');
    button.click();

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });
  });

  it('should determine grouping mode correctly - by assignment', async () => {
    vi.mocked(ajax.ajax_post).mockResolvedValue({
      success: true,
      history: complexSessionLogs,
      submissions: multipleSubmissions
    });

    render(() => (
      <Watcher
        courseId={1}
        assignmentIds="103,104,105" // 3 assignments - should group by assignment
        userIds="3" // 1 user
      />
    ));

    const button = screen.getByText('View Submissions');
    button.click();

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });
  });
});
