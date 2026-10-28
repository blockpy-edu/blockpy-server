/**
 * Utilities for processing raw dashboard data from the server
 * into chart-friendly structures.
 */

import type {
  DashboardData,
  AssignmentMetricSummary,
  StudentMetricSummary,
} from '../types/models';

type MetricsMap = Record<string, number | string | null>;

/** Format raw seconds value as "Xh Ym Zs". */
export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0s';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (s > 0 || parts.length === 0) parts.push(`${s}s`);
  return parts.join(' ');
}

/** Safe numeric getter from a metrics map. */
function num(m: MetricsMap, key: string): number {
  const v = m[key];
  return typeof v === 'number' ? v : 0;
}

export interface ProcessedDashboard {
  byAssignment: AssignmentMetricSummary[];
  byStudent: StudentMetricSummary[];
  totals: {
    submissions: number;
    uniqueStudents: number;
    uniqueAssignments: number;
    avgTimeSpent: number;
    avgScore: number;
    overallSyntaxErrorRate: number;
    overallRuntimeErrorRate: number;
  };
}

export function processDashboardData(
  data: DashboardData,
  assignmentNames: Record<string, string> = {}
): ProcessedDashboard {
  // data.counts = [ [assignment_url, user_id, metrics_object], ... ]
  const rows = data.counts;

  // Group by assignment_url
  const assignmentGroups = new Map<string, MetricsMap[]>();
  const studentGroups = new Map<number, MetricsMap[]>();

  for (const [aUrl, userId, metrics] of rows) {
    if (!assignmentGroups.has(aUrl)) assignmentGroups.set(aUrl, []);
    assignmentGroups.get(aUrl)!.push(metrics);

    if (!studentGroups.has(userId)) studentGroups.set(userId, []);
    studentGroups.get(userId)!.push(metrics);
  }

  // Per-assignment summaries
  const byAssignment: AssignmentMetricSummary[] = [];
  for (const [aUrl, metricsArr] of assignmentGroups.entries()) {
    const n = metricsArr.length;
    const sumInterventions = metricsArr.reduce((s, m) => s + num(m, 'total_interventions'), 0);
    byAssignment.push({
      assignment_url: aUrl,
      assignment_name: assignmentNames[aUrl] ?? aUrl.split('/').pop() ?? aUrl,
      submission_count: n,
      avg_total_edits: metricsArr.reduce((s, m) => s + num(m, 'total_edits'), 0) / (n || 1),
      avg_time_spent: metricsArr.reduce((s, m) => s + num(m, 'total_time_spent'), 0) / (n || 1),
      avg_interventions: sumInterventions / (n || 1),
      syntax_error_rate:
        sumInterventions > 0
          ? metricsArr.reduce((s, m) => s + num(m, 'feedback_syntax_errors'), 0) / sumInterventions
          : 0,
      runtime_error_rate:
        sumInterventions > 0
          ? metricsArr.reduce((s, m) => s + num(m, 'feedback_runtime_errors'), 0) / sumInterventions
          : 0,
      assertion_success_rate: (() => {
        const totalCounts = metricsArr.reduce(
          (s, m) => s + num(m, 'feedback_assertion_counts'),
          0
        );
        const totalSuccesses = metricsArr.reduce(
          (s, m) => s + num(m, 'feedback_assertion_successes'),
          0
        );
        return totalCounts > 0 ? totalSuccesses / totalCounts : 0;
      })(),
      avg_feedback_total: metricsArr.reduce((s, m) => s + num(m, 'feedback_total'), 0) / (n || 1),
    });
  }

  byAssignment.sort((a, b) => a.assignment_name.localeCompare(b.assignment_name));

  // Per-student summaries
  const byStudent: StudentMetricSummary[] = [];
  for (const [userId, metricsArr] of studentGroups.entries()) {
    const n = metricsArr.length;
    byStudent.push({
      user_id: userId,
      submission_count: n,
      avg_score: metricsArr.reduce((s, m) => s + num(m, 'score'), 0) / (n || 1),
      avg_time_spent: metricsArr.reduce((s, m) => s + num(m, 'total_time_spent'), 0) / (n || 1),
      avg_edits: metricsArr.reduce((s, m) => s + num(m, 'total_edits'), 0) / (n || 1),
      correct_count: metricsArr.reduce((s, m) => s + (num(m, 'correct') > 0 ? 1 : 0), 0),
    });
  }

  byStudent.sort((a, b) => b.avg_score - a.avg_score);

  // Totals
  const allMetrics = rows.map(([, , m]) => m);
  const totalInterventions = allMetrics.reduce((s, m) => s + num(m, 'total_interventions'), 0);

  return {
    byAssignment,
    byStudent,
    totals: {
      submissions: rows.length,
      uniqueStudents: studentGroups.size,
      uniqueAssignments: assignmentGroups.size,
      avgTimeSpent:
        allMetrics.reduce((s, m) => s + num(m, 'total_time_spent'), 0) / (rows.length || 1),
      avgScore: allMetrics.reduce((s, m) => s + num(m, 'score'), 0) / (rows.length || 1),
      overallSyntaxErrorRate:
        totalInterventions > 0
          ? allMetrics.reduce((s, m) => s + num(m, 'feedback_syntax_errors'), 0) /
            totalInterventions
          : 0,
      overallRuntimeErrorRate:
        totalInterventions > 0
          ? allMetrics.reduce((s, m) => s + num(m, 'feedback_runtime_errors'), 0) /
            totalInterventions
          : 0,
    },
  };
}
