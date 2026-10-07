/**
 * Table showing per-student summary metrics.
 */

import type { StudentMetricSummary } from '../../types/models';
import { formatDuration } from '../../api/dashboardUtils';

interface Props {
  data: StudentMetricSummary[];
}

const thStyle: React.CSSProperties = {
  background: '#1cc88a',
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

export default function StudentTable({ data }: Props) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Student Summary</h3>
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
            <th style={thStyle}>User ID</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Submissions</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Correct</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Avg Score</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Avg Time</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Avg Edits</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={row.user_id} style={{ background: i % 2 === 0 ? '#f8f9fc' : '#fff' }}>
              <td style={tdStyle}>{row.user_id}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{row.submission_count}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>
                {row.correct_count} / {row.submission_count}
              </td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{row.avg_score.toFixed(1)}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{formatDuration(row.avg_time_spent)}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{row.avg_edits.toFixed(1)}</td>
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td colSpan={6} style={{ ...tdStyle, color: '#888', textAlign: 'center', padding: 24 }}>
                No student data available.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
