/**
 * API client for the BlockPy server.
 *
 * All API functions return typed responses or throw an error.
 * The base URL is read from window.$URL_ROOT when available,
 * otherwise defaults to the current origin (useful in dev proxy mode).
 */

import type {
  Course,
  CoursesListResponse,
  DashboardData,
  TaskStatus,
} from '../types/models';

function getBaseUrl(): string {
  // Injected by Flask layout template
  if (typeof window !== 'undefined' && (window as Window & { $URL_ROOT?: string }).$URL_ROOT) {
    const root = (window as Window & { $URL_ROOT?: string }).$URL_ROOT as string;
    return root.endsWith('/') ? root.slice(0, -1) : root;
  }
  return '';
}

async function fetchJson<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const url = `${getBaseUrl()}${path}`;
  const response = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options?.headers ?? {}),
    },
    ...options,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  return response.json() as Promise<T>;
}

// ---- /api/* endpoints ----

/** GET /api/test — sanity-check the server connection. */
export async function apiTest(): Promise<string> {
  return fetchJson<string>('/api/test');
}

/** GET/POST /api/list/courses — list courses for the current user. */
export async function listCourses(email?: string, password?: string): Promise<Course[]> {
  const body = email && password ? JSON.stringify({ email, password }) : undefined;
  const data = await fetchJson<CoursesListResponse>('/api/list/courses', {
    method: body ? 'POST' : 'GET',
    body,
  });
  return data.courses;
}

/** GET /api/task_status/:taskId — poll a background task. */
export async function getTaskStatus(taskId: string): Promise<TaskStatus> {
  return fetchJson<TaskStatus>(`/api/task_status/${taskId}`);
}

/** GET /api/reports — list reports for the current user. */
export async function listReports(): Promise<unknown[]> {
  const data = await fetchJson<{ reports: unknown[] }>('/api/reports');
  return data.reports;
}

// ---- /courses/* endpoints ----

/** GET /courses/ — list courses (HTML endpoint, returns assignments page context via JSON). */
export async function getCourseAssignments(courseId: number): Promise<unknown> {
  return fetchJson<unknown>(`/courses/assignments/${courseId}`);
}

/** GET /courses/users?course_id=X — get users in a course. */
export async function getCourseUsers(courseId: number): Promise<unknown> {
  return fetchJson<unknown>(`/courses/users?course_id=${courseId}`);
}

/**
 * GET /courses/fake_dashboard?course_id=X&mode=json
 *
 * Returns per-submission metric rows for the given course.
 */
export async function getCourseMetrics(
  courseId: number,
  studentIds?: number[]
): Promise<DashboardData> {
  let url = `/courses/fake_dashboard?course_id=${courseId}&mode=json`;
  if (studentIds && studentIds.length > 0) {
    url += `&student_ids=${studentIds.join(',')}`;
  }
  return fetchJson<DashboardData>(url);
}

/**
 * GET /courses/fake_dashboard?course_id=X&mode=csv
 *
 * Returns the metrics as a CSV blob (used for export).
 */
export async function getCourseMetricsCsv(courseId: number): Promise<Blob> {
  const url = `${getBaseUrl()}/courses/fake_dashboard?course_id=${courseId}&mode=csv`;
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.blob();
}

// ---- /assignments/* endpoints ----

/** GET /assignments/get?assignment_id=X — get a single assignment. */
export async function getAssignment(assignmentId: number): Promise<unknown> {
  return fetchJson<unknown>(`/assignments/get?assignment_id=${assignmentId}`);
}

/** GET /assignments/get_ids?course_id=X — list assignments in a course. */
export async function getCourseAssignmentIds(courseId: number): Promise<unknown> {
  return fetchJson<unknown>(`/assignments/get_ids?course_id=${courseId}`);
}

// ---- /grading/* endpoints ----

/** GET /grading/get_grading_spreadsheet?course_id=X — grading spreadsheet data. */
export async function getGradingSpreadsheet(
  courseIds: number[],
  assignmentIds?: number[],
  assignmentGroupIds?: number[]
): Promise<unknown> {
  const params = new URLSearchParams();
  courseIds.forEach((id) => params.append('course_ids', String(id)));
  if (assignmentIds) assignmentIds.forEach((id) => params.append('assignment_ids', String(id)));
  if (assignmentGroupIds)
    assignmentGroupIds.forEach((id) => params.append('assignment_group_ids', String(id)));
  return fetchJson<unknown>(`/grading/get_grading_spreadsheet?${params.toString()}`);
}

// ---- /blockpy/* endpoints ----

/** POST /blockpy/update_submission — submit/update a submission. */
export async function updateSubmission(params: Record<string, unknown>): Promise<unknown> {
  return fetchJson<unknown>('/blockpy/update_submission', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}
