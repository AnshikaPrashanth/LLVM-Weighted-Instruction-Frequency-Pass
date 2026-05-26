import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend,
} from 'recharts';
import { CATEGORIES, CATEGORY_COLORS } from '../utils/analysis';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  const total = payload.reduce((s, p) => s + (p.value || 0), 0);
  return (
    <div className="custom-tooltip">
      <p className="custom-tooltip-label">{label}</p>
      {payload.map((p) => p.value > 0 && (
        <div className="custom-tooltip-row" key={p.name}>
          <span className="custom-tooltip-key" style={{ color: p.fill }}>{p.name}</span>
          <span className="custom-tooltip-val">{p.value.toFixed(2)}</span>
        </div>
      ))}
      <div className="custom-tooltip-row" style={{ marginTop: 6, borderTop: '1px solid var(--border)', paddingTop: 6 }}>
        <span className="custom-tooltip-key">Total</span>
        <span className="custom-tooltip-val">{total.toFixed(2)}</span>
      </div>
    </div>
  );
}

export default function FunctionCostChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="chart-card animate-in">
        <p className="chart-card-title">Function Cost Breakdown</p>
        <div className="empty-state">
          <span className="empty-state-icon">📊</span>
          <p className="empty-state-title">No data to display</p>
          <p className="empty-state-sub">Upload a results.csv or load sample data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chart-card animate-in delay-1">
      <p className="chart-card-title">Function Cost Breakdown</p>
      <p className="chart-card-sub">
        Stacked weighted cost per function — using FUNCTION_TOTAL rows only
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 4, right: 20, left: 0, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="function"
            tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
            angle={-35}
            textAnchor="end"
            interval={0}
            height={60}
          />
          <YAxis
            tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
            label={{
              value: 'Weighted Cost',
              angle: -90,
              position: 'insideLeft',
              style: { fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' },
              dx: -4,
            }}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          {CATEGORIES.map((cat) => (
            <Bar key={cat} dataKey={cat} stackId="a" fill={CATEGORY_COLORS[cat]} maxBarSize={56} />
          ))}
        </BarChart>
      </ResponsiveContainer>
      <div className="chart-legend">
        {CATEGORIES.map((c) => (
          <span className="legend-item" key={c}>
            <span className="legend-dot" style={{ background: CATEGORY_COLORS[c] }} />
            {c}
          </span>
        ))}
      </div>
    </div>
  );
}
