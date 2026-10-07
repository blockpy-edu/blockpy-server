/**
 * Detailed metrics table — one row per assignment.
 */

import type { AssignmentMetricSummary } from '../../types/models';
import { formatDuration } from '../../api/dashboardUtils';

interface Props {
  data: AssignmentMetricSummary[];
}

const thStyle: React.CSSProperties = {
  background: '#4e73df',
  color: '#fff',
  padding: '8px 12px',
  textAlign: 'left',
  fontWeight: 600,
  fontSize: 13,
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '7px 12px',
  fontSize: 13,
  borderBottom: '1px solid #dee2e6',
};

function pct(v: number) {
  return `${(v * 100).toFixed(1)}%`;
}

export default function MetricsTable({ data }: Props) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
        Assignment Metrics Detail
      </h3>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 13,
          background: '#fff',
          borderRadius: 8,
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,.07)',
        }}
      >
        <thead>
          <tr>
            <th style={thStyle}>Assignment</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Submissions</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Avg Edits</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Avg Time</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Avg Runs</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Syntax Err%</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Runtime Err%</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Assert Pass%</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Avg Feedback</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={row.assignment_url} style={{ background: i % 2 === 0 ? '#f8f9fc' : '#fff' }}>
              <td style={tdStyle} title={row.assignment_url}>
                {row.assignment_name}
              </td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{row.submission_count}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{row.avg_total_edits.toFixed(1)}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{formatDuration(row.avg_time_spent)}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{row.avg_interventions.toFixed(1)}</td>
              <td style={{ ...tdStyle, textAlign: 'right', color: row.syntax_error_rate > 0.3 ? '#e74a3b' : 'inherit' }}>
                {pct(row.syntax_error_rate)}
              </td>
              <td style={{ ...tdStyle, textAlign: 'right', color: row.runtime_error_rate > 0.3 ? '#f6c23e' : 'inherit' }}>
                {pct(row.runtime_error_rate)}
              </td>
              <td
                style={{
                  ...tdStyle,
                  textAlign: 'right',
                  color: row.assertion_success_rate > 0.7 ? '#1cc88a' : '#e74a3b',
                }}
              >
                {pct(row.assertion_success_rate)}
              </td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{row.avg_feedback_total.toFixed(1)}</td>
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td colSpan={9} style={{ ...tdStyle, color: '#888', textAlign: 'center', padding: 24 }}>
                No data available.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
