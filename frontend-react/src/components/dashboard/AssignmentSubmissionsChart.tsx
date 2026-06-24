/**
 * Bar chart showing per-assignment submission counts and average time spent.
 */

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { AssignmentMetricSummary } from '../../types/models';
import { formatDuration } from '../../api/dashboardUtils';

interface Props {
  data: AssignmentMetricSummary[];
}

interface ChartRow {
  name: string;
  submissions: number;
  avgEdits: number;
  avgTimeSpentMin: number;
}

const COLORS = {
  submissions: '#4e73df',
  avgEdits: '#1cc88a',
  avgTime: '#36b9cc',
};

export default function AssignmentSubmissionsChart({ data }: Props) {
  const chartData: ChartRow[] = data.map((d) => ({
    name: d.assignment_name.length > 20 ? d.assignment_name.slice(0, 18) + '…' : d.assignment_name,
    submissions: d.submission_count,
    avgEdits: Math.round(d.avg_total_edits),
    avgTimeSpentMin: Math.round(d.avg_time_spent / 60),
  }));

  return (
    <div>
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
        Submissions &amp; Edits per Assignment
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="name"
            angle={-35}
            textAnchor="end"
            interval={0}
            tick={{ fontSize: 11 }}
          />
          <YAxis />
          <Tooltip
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any, name: any) => {
              const v = typeof value === 'number' ? value : 0;
              if (name === 'avgTimeSpentMin') return [`${v} min`, 'Avg Time Spent'];
              return [v, name === 'submissions' ? 'Submissions' : 'Avg Edits'];
            }}
          />
          <Legend
            verticalAlign="top"
            formatter={(value: string) => {
              const labels: Record<string, string> = {
                submissions: 'Submissions',
                avgEdits: 'Avg Edits',
                avgTimeSpentMin: 'Avg Time (min)',
              };
              return labels[value] ?? value;
            }}
          />
          <Bar dataKey="submissions" fill={COLORS.submissions} radius={[3, 3, 0, 0]} />
          <Bar dataKey="avgEdits" fill={COLORS.avgEdits} radius={[3, 3, 0, 0]} />
          <Bar dataKey="avgTimeSpentMin" fill={COLORS.avgTime} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <p style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
        Hover bars for details. Time shown in minutes. Raw avg time:{' '}
        {data.map((d) => `${d.assignment_name}: ${formatDuration(d.avg_time_spent)}`).join(' | ')}
      </p>
    </div>
  );
}
