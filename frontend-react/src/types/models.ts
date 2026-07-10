/**
 * TypeScript models matching the BlockPy server data structures.
 */

// ---- Enums ----

export type SubmissionStatus = 'started' | 'submitted' | 'completed' | 'inProgress';
export type GradingStatus = 'not_ready' | 'queued' | 'failed' | 'done' | 'waiting';

/** Mirrors models/enums/metrics.py SubmissionMetrics */
export type SubmissionMetric =
  | 'total_edit_time'
  | 'total_edits'
  | 'total_intervention_time'
  | 'total_interventions'
  | 'total_time_spent'
  | 'total_read_time'
  | 'total_active_read_time'
  | 'total_watch_time'
  | 'pastes'
  | 'emojis'
  | 'window_visibility_changes'
  | 'feedback_total'
  | 'feedback_syntax_errors'
  | 'feedback_runtime_errors'
  | 'feedback_assertion_counts'
  | 'feedback_assertion_successes'
  | 'feedback_assertion_feedbacks'
  | 'feedback_assertion_feedback_successes';

// ---- Core Models ----

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
}

export interface Course {
  id: number;
  name: string;
  url: string;
  visibility: string;
  date_created?: string;
}

export interface Assignment {
  id: number;
  name: string;
  url: string;
  type: string;
  course_id: number;
  reviewed: boolean;
  hidden: boolean;
}

export interface AssignmentGroup {
  id: number;
  name: string;
  url: string;
  course_id: number;
  position: number;
}

export interface Submission {
  id: number;
  user_id: number;
  assignment_id: number;
  course_id: number;
  code: string;
  score: number;
  correct: boolean;
  submission_status: SubmissionStatus;
  grading_status: GradingStatus;
  date_created?: string;
  date_modified?: string;
  date_submitted?: string;
  url: string;
}

// ---- Counts Tables ----

export interface SubmissionCounts {
  submission_id: number;
  metric: SubmissionMetric;
  value: number;
}

export interface CourseCounts {
  course_id: number;
  total_submissions: number;
  total_assignments: number;
  total_assignment_groups: number;
  total_users: number;
  total_students: number;
  total_instructors: number;
  date_last_user?: string;
  date_last_submission?: string;
  date_last_assignment?: string;
}

export interface AssignmentCounts {
  assignment_id: number;
  total_submissions: number;
  date_last_submission?: string;
}

export interface UserCounts {
  user_id: number;
  total_courses_in: number;
  total_assignments: number;
  total_submissions: number;
  total_reports: number;
  estimated_time_spent: number;
  last_logged_in?: string;
  last_edited?: string;
}

// ---- Dashboard Aggregate Types ----

/** Row returned by /courses/fake_dashboard?mode=json */
export interface DashboardRow {
  assignment_url: string;
  user_id: number;
  metrics: Record<string, number | string | null>;
}

/** Dashboard data as returned by the fake_dashboard endpoint */
export interface DashboardData {
  counts: [string, number, Record<string, number | string | null>][];
}

/** Per-assignment aggregated metrics for display */
export interface AssignmentMetricSummary {
  assignment_url: string;
  assignment_name: string;
  submission_count: number;
  avg_total_edits: number;
  avg_time_spent: number;
  avg_interventions: number;
  syntax_error_rate: number;
  runtime_error_rate: number;
  assertion_success_rate: number;
  avg_feedback_total: number;
}

/** Per-student aggregated metrics */
export interface StudentMetricSummary {
  user_id: number;
  submission_count: number;
  avg_score: number;
  avg_time_spent: number;
  avg_edits: number;
  correct_count: number;
}

// ---- API Response Wrappers ----

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  message: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export interface CoursesListResponse {
  courses: Course[];
}

export interface TaskResponse {
  task_id: string;
  status_url: string;
}

export interface TaskStatus {
  status: 'Pending' | 'Complete' | 'Error';
  message: unknown;
}

export interface GradingSpreadsheetRow {
  user_id: number;
  assignment_id: number;
  submission_id: number;
  score: number;
  correct: boolean;
  [key: string]: unknown;
}
