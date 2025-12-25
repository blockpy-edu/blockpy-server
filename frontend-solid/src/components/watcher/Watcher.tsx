/**
 * Watcher - Main SolidJS component for watching student submissions
 */

import { createSignal, For, Show } from 'solid-js';
import { Log, LogJson } from '../../models/log';
import { User, UserJson } from '../../models/user';
import { Assignment, AssignmentJson } from '../../models/assignment';
import { Submission, SubmissionJson } from '../../models/submission';
import { ajax_post } from '../../services/ajax';
import { SubmissionHistory } from './SubmissionHistory';
import { WatchMode } from './SubmissionState';

export enum WatchGroupingMode {
  NONE = 'None',
  ASSIGNMENT = 'Assignment',
  USER = 'User'
}

interface WatcherProps {
  courseId: number;
  assignmentIds?: string;
  userIds?: string;
  defaultWatchMode?: WatchMode;
}

interface SubmissionHistoryData {
  user: User;
  assignment: Assignment;
  submission: Submission;
  logs: Log[];
}

export function Watcher(props: WatcherProps) {
  const [submissions, setSubmissions] = createSignal<SubmissionHistoryData[]>([]);
  const [grouping, setGrouping] = createSignal<WatchGroupingMode>(WatchGroupingMode.NONE);
  const [isLoading, setIsLoading] = createSignal(false);
  const [hasFailed, setHasFailed] = createSignal(false);

  // Store users and assignments by ID for lookup
  const [usersById, setUsersById] = createSignal<Map<number, User>>(new Map());
  const [assignmentsById, setAssignmentsById] = createSignal<Map<number, Assignment>>(new Map());

  function getOrCreateUser(userId: number): User {
    const users = usersById();
    if (users.has(userId)) {
      return users.get(userId)!;
    }
    // Create a placeholder user
    const user = new User({ 
      id: userId, 
      first_name: 'User', 
      last_name: String(userId),
      email: ''
    });
    users.set(userId, user);
    setUsersById(new Map(users));
    return user;
  }

  function getOrCreateAssignment(assignmentId: number): Assignment {
    const assignments = assignmentsById();
    if (assignments.has(assignmentId)) {
      return assignments.get(assignmentId)!;
    }
    // Create a placeholder assignment
    const assignment = new Assignment({
      id: assignmentId,
      name: `Assignment ${assignmentId}`
    });
    assignments.set(assignmentId, assignment);
    setAssignmentsById(new Map(assignments));
    return assignment;
  }

  function addLogs(logJsons: LogJson[]) {
    const sortedLogs: Record<string, Log[]> = {};
    const newSubmissionsMap: Map<string, SubmissionHistoryData> = new Map();

    // Get existing submissions
    const existingSubmissions = submissions();
    existingSubmissions.forEach(sub => {
      const key = `${sub.submission.courseId()}-${sub.assignment.id}-${sub.user.id}`;
      newSubmissionsMap.set(key, sub);
    });

    // Process logs
    for (const logJson of logJsons) {
      const log = new Log(logJson);
      const submissionId = log.getAsSubmissionKey();

      if (!newSubmissionsMap.has(submissionId)) {
        const user = getOrCreateUser(log.subjectId());
        const assignment = getOrCreateAssignment(log.assignmentId());
        const submission = new Submission({
          id: 0, // placeholder
          user_id: log.subjectId(),
          assignment_id: log.assignmentId(),
          course_id: log.courseId(),
        });

        newSubmissionsMap.set(submissionId, {
          user,
          assignment,
          submission,
          logs: []
        });
      }

      if (!(submissionId in sortedLogs)) {
        sortedLogs[submissionId] = [];
      }
      sortedLogs[submissionId].push(log);
    }

    // Add logs to submissions
    for (const submissionId in sortedLogs) {
      const subData = newSubmissionsMap.get(submissionId);
      if (subData) {
        subData.logs = [...subData.logs, ...sortedLogs[submissionId]];
      }
    }

    setSubmissions(Array.from(newSubmissionsMap.values()));
  }

  function addSubmissionsData(submissionJsons: SubmissionJson[]) {
    const newSubmissionsMap: Map<string, SubmissionHistoryData> = new Map();

    // Get existing submissions
    const existingSubmissions = submissions();
    existingSubmissions.forEach(sub => {
      const key = sub.submission.getAsSubmissionKey();
      newSubmissionsMap.set(key, sub);
    });

    for (const subJson of submissionJsons) {
      const submission = new Submission(subJson);
      const submissionId = submission.getAsSubmissionKey();

      if (!newSubmissionsMap.has(submissionId)) {
        const user = getOrCreateUser(submission.userId());
        const assignment = getOrCreateAssignment(submission.assignmentId());

        newSubmissionsMap.set(submissionId, {
          user,
          assignment,
          submission,
          logs: []
        });
      } else {
        newSubmissionsMap.get(submissionId)!.submission = submission;
      }
    }

    setSubmissions(Array.from(newSubmissionsMap.values()));
  }

  function determineGroupingMode(assignmentIds: string, userIds: string) {
    const assignmentCount = assignmentIds.split(',').filter(id => id.trim()).length;
    const userCount = userIds.split(',').filter(id => id.trim()).length;

    if (userCount > assignmentCount) {
      setGrouping(WatchGroupingMode.USER);
    } else if (userCount < assignmentCount) {
      setGrouping(WatchGroupingMode.ASSIGNMENT);
    } else {
      setGrouping(WatchGroupingMode.NONE);
    }
  }

  async function getLatest() {
    const assignmentIds = props.assignmentIds || '';
    const userIds = props.userIds || '';

    setIsLoading(true);
    setHasFailed(false);
    determineGroupingMode(assignmentIds, userIds);

    try {
      const data = await ajax_post<{
        success: boolean;
        history: LogJson[];
        submissions: SubmissionJson[];
      }>('blockpy/load_history', {
        assignment_id: assignmentIds,
        course_id: props.courseId,
        user_id: userIds,
        with_submission: true
      });

      setIsLoading(false);
      
      if (data.success) {
        setSubmissions([]);
        addLogs(data.history);
        addSubmissionsData(data.submissions);
      } else {
        console.error('Loading history failed!', data);
        setHasFailed(true);
      }
    } catch (error) {
      console.error('Loading history failed to get data!', error);
      setHasFailed(true);
      setIsLoading(false);
    }
  }

  return (
    <div>
      <div class="mb-4 mt-4">
        <button class="btn btn-primary" onClick={getLatest}>
          View Submissions
        </button>
      </div>

      <Show when={isLoading()}>
        <div class="spinner-loader" role="status">
          <span class="sr-only">Loading...</span>
        </div>
      </Show>

      <Show when={hasFailed()}>
        <div class="alert alert-danger" role="alert">
          Loading these events has failed; more details in JS console.
        </div>
      </Show>

      <Show when={!isLoading()}>
        <div class="row">
          <For each={submissions()}>
            {(submissionData) => (
              <div class="col-md-12 mb-4 rounded bg-light">
                <SubmissionHistory
                  user={submissionData.user}
                  assignment={submissionData.assignment}
                  submission={submissionData.submission}
                  defaultWatchMode={props.defaultWatchMode}
                  grouping={grouping()}
                />
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
