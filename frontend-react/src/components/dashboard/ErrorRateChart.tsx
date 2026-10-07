/**
 * Stacked bar chart showing error rates per assignment.
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

interface Props {
  data: AssignmentMetricSummary[];
}

export default function ErrorRateChart({ data }: Props) {
  const chartData = data.map((d) => ({
    name: d.assignment_name.length > 20 ? d.assignment_name.slice(0, 18) + '…' : d.assignment_name,
    syntaxErrorRate: parseFloat((d.syntax_error_rate * 100).toFixed(1)),
    runtimeErrorRate: parseFloat((d.runtime_error_rate * 100).toFixed(1)),
    assertionSuccessRate: parseFloat((d.assertion_success_rate * 100).toFixed(1)),
  }));

  return (
    <div>
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
        Error &amp; Success Rates per Assignment (%)
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
          <YAxis domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <Tooltip formatter={(v: any) => `${typeof v === 'number' ? v : 0}%`} />
          <Legend verticalAlign="top" />
          <Bar dataKey="syntaxErrorRate" name="Syntax Error Rate" fill="#e74a3b" radius={[3, 3, 0, 0]} />
          <Bar dataKey="runtimeErrorRate" name="Runtime Error Rate" fill="#f6c23e" radius={[3, 3, 0, 0]} />
          <Bar
            dataKey="assertionSuccessRate"
            name="Assertion Success Rate"
            fill="#1cc88a"
            radius={[3, 3, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
      <p style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
        Error rates are calculated as errors per run attempt. Success rate = passing assertions / total assertions.
      </p>
    </div>
  );
}
