/**
 * Instructor Dashboard page.
 *
 * Shows submission metrics for a selected course using charts and tables.
 * Data comes from /courses/fake_dashboard?mode=json.
 */

import { useState, useMemo } from 'react';
import type { Course } from '../types/models';
import { useCourses, useCourseMetrics } from '../hooks/useFetch';
import { processDashboardData } from '../api/dashboardUtils';
import { getCourseMetricsCsv } from '../api/client';
import StatCard from '../components/dashboard/StatCard';
import AssignmentSubmissionsChart from '../components/dashboard/AssignmentSubmissionsChart';
import ErrorRateChart from '../components/dashboard/ErrorRateChart';
import MetricsTable from '../components/dashboard/MetricsTable';
import StudentTable from '../components/dashboard/StudentTable';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function InstructorDashboard() {
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'charts' | 'assignment-table' | 'student-table'>(
    'charts'
  );
  const [csvLoading, setCsvLoading] = useState(false);

  const coursesState = useCourses();
  const metricsState = useCourseMetrics(selectedCourseId);

  const processed = useMemo(() => {
    if (!metricsState.data) return null;
    return processDashboardData(metricsState.data);
  }, [metricsState.data]);

  function handleCourseChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = parseInt(e.target.value, 10);
    setSelectedCourseId(isNaN(val) ? null : val);
  }

  async function handleExportCsv() {
    if (!selectedCourseId) return;
    setCsvLoading(true);
    try {
      const blob = await getCourseMetricsCsv(selectedCourseId);
      downloadBlob(blob, `metrics_course_${selectedCourseId}.csv`);
    } catch (e) {
      alert(`CSV export failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setCsvLoading(false);
    }
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 18px',
    border: 'none',
    borderRadius: '6px 6px 0 0',
    background: active ? '#fff' : '#e9ecef',
    color: active ? '#4e73df' : '#495057',
    fontWeight: active ? 700 : 400,
    cursor: 'pointer',
    fontSize: 14,
    marginRight: 4,
    borderBottom: active ? '2px solid #4e73df' : '2px solid transparent',
  });

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, color: '#2c3e50' }}>
          📊 Instructor Dashboard
        </h1>
        <p style={{ color: '#6c757d', marginTop: 4, marginBottom: 16 }}>
          Submission metrics and analytics for your courses.
        </p>

        {/* Course selector */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ fontWeight: 600, fontSize: 14 }} htmlFor="course-select">
            Course:
          </label>
          {coursesState.loading && <span style={{ color: '#6c757d' }}>Loading courses…</span>}
          {coursesState.error && (
            <span style={{ color: '#e74a3b' }}>Error: {coursesState.error}</span>
          )}
          {coursesState.data && (
            <select
              id="course-select"
              value={selectedCourseId ?? ''}
              onChange={handleCourseChange}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid #ced4da',
                fontSize: 14,
                minWidth: 240,
              }}
            >
              <option value="">— Select a course —</option>
              {coursesState.data.map((c: Course) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          {selectedCourseId && (
            <>
              <button
                onClick={() => metricsState.refetch()}
                disabled={metricsState.loading}
                style={{
                  padding: '6px 14px',
                  background: '#4e73df',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
                {metricsState.loading ? 'Loading…' : '↻ Refresh'}
              </button>
              <button
                onClick={handleExportCsv}
                disabled={csvLoading}
                style={{
                  padding: '6px 14px',
                  background: '#1cc88a',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
                {csvLoading ? 'Exporting…' : '⬇ Export CSV'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* State messages */}
      {!selectedCourseId && !coursesState.loading && (
        <div
          style={{
            background: '#e8f4fd',
            border: '1px solid #bee5eb',
            borderRadius: 8,
            padding: 20,
            color: '#0c5460',
          }}
        >
          Select a course above to view submission metrics.
        </div>
      )}

      {metricsState.loading && (
        <div style={{ textAlign: 'center', padding: 48, color: '#6c757d' }}>
          Loading metrics…
        </div>
      )}

      {metricsState.error && (
        <div
          style={{
            background: '#fdf3f2',
            border: '1px solid #f5c6cb',
            borderRadius: 8,
            padding: 20,
            color: '#721c24',
          }}
        >
          <strong>Error loading metrics:</strong> {metricsState.error}
        </div>
      )}

      {/* Dashboard content */}
      {processed && !metricsState.loading && (
        <>
          {/* Stat cards */}
          <div
            style={{
              display: 'flex',
              gap: 16,
              flexWrap: 'wrap',
              marginBottom: 28,
            }}
          >
            <StatCard label="Total Submissions" value={processed.totals.submissions} />
            <StatCard label="Unique Students" value={processed.totals.uniqueStudents} />
            <StatCard label="Assignments" value={processed.totals.uniqueAssignments} />
            <StatCard
              label="Avg Time Spent"
              value={
                processed.totals.avgTimeSpent > 0
                  ? `${Math.round(processed.totals.avgTimeSpent / 60)} min`
                  : 'N/A'
              }
            />
            <StatCard
              label="Avg Score"
              value={processed.totals.avgScore.toFixed(1)}
              color={processed.totals.avgScore >= 70 ? '#1cc88a' : '#e74a3b'}
            />
            <StatCard
              label="Syntax Error Rate"
              value={`${(processed.totals.overallSyntaxErrorRate * 100).toFixed(1)}%`}
              color={processed.totals.overallSyntaxErrorRate > 0.3 ? '#e74a3b' : '#212529'}
            />
            <StatCard
              label="Runtime Error Rate"
              value={`${(processed.totals.overallRuntimeErrorRate * 100).toFixed(1)}%`}
              color={processed.totals.overallRuntimeErrorRate > 0.3 ? '#f6c23e' : '#212529'}
            />
          </div>

          {/* Empty state */}
          {processed.byAssignment.length === 0 && (
            <div
              style={{
                background: '#fff3cd',
                border: '1px solid #ffeeba',
                borderRadius: 8,
                padding: 20,
                color: '#856404',
              }}
            >
              No submission data found for this course. Students may not have started assignments yet.
            </div>
          )}

          {processed.byAssignment.length > 0 && (
            <>
              {/* Tabs */}
              <div style={{ borderBottom: '1px solid #dee2e6', marginBottom: 0 }}>
                <button style={tabStyle(activeTab === 'charts')} onClick={() => setActiveTab('charts')}>
                  Charts
                </button>
                <button
                  style={tabStyle(activeTab === 'assignment-table')}
                  onClick={() => setActiveTab('assignment-table')}
                >
                  Assignment Table
                </button>
                <button
                  style={tabStyle(activeTab === 'student-table')}
                  onClick={() => setActiveTab('student-table')}
                >
                  Student Table
                </button>
              </div>

              <div
                style={{
                  background: '#fff',
                  border: '1px solid #dee2e6',
                  borderTop: 'none',
                  borderRadius: '0 0 8px 8px',
                  padding: 24,
                  boxShadow: '0 1px 3px rgba(0,0,0,.07)',
                }}
              >
                {activeTab === 'charts' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
                    <AssignmentSubmissionsChart data={processed.byAssignment} />
                    <hr style={{ border: 'none', borderTop: '1px solid #dee2e6' }} />
                    <ErrorRateChart data={processed.byAssignment} />
                  </div>
                )}
                {activeTab === 'assignment-table' && (
                  <MetricsTable data={processed.byAssignment} />
                )}
                {activeTab === 'student-table' && (
                  <StudentTable data={processed.byStudent} />
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
