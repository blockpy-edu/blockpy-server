/** Small summary card shown at the top of the dashboard. */

import type { CSSProperties } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}

const cardStyle: CSSProperties = {
  background: '#fff',
  border: '1px solid #dee2e6',
  borderRadius: 8,
  padding: '16px 20px',
  minWidth: 140,
  flex: '1 1 140px',
  boxShadow: '0 1px 3px rgba(0,0,0,.07)',
};

const labelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  color: '#6c757d',
  marginBottom: 4,
};

const valueStyle: CSSProperties = {
  fontSize: 28,
  fontWeight: 700,
  lineHeight: 1,
  marginBottom: 4,
};

const subStyle: CSSProperties = {
  fontSize: 12,
  color: '#6c757d',
};

export default function StatCard({ label, value, sub, color = '#212529' }: StatCardProps) {
  return (
    <div style={cardStyle}>
      <div style={labelStyle}>{label}</div>
      <div style={{ ...valueStyle, color }}>{value}</div>
      {sub && <div style={subStyle}>{sub}</div>}
    </div>
  );
}
