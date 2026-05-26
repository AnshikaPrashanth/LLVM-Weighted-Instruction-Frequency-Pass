import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell,
} from 'recharts';

function CustomTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="custom-tooltip">
      <p className="custom-tooltip-label">{payload[0].payload.function}</p>
      {payload.map((p, i) => (
        <div className="custom-tooltip-row" key={i}>
          <span className="custom-tooltip-key" style={{ color: p.fill }}>
            {p.name}
          </span>
          <span className="custom-tooltip-val">{p.value.toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}

export default function OptimizationComparisonChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="chart-card animate-in">
        <p className="chart-card-title">O0 vs O2 Optimization Deltas</p>
        <div className="empty-state">
          <span className="empty-state-icon">📊</span>
          <p className="empty-state-title">No comparison data</p>
          <p className="empty-state-sub">Upload optimization_delta.csv to see deltas</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chart-card animate-in delay-2">
      <p className="chart-card-title">O0 vs O2 Optimization Deltas</p>
      <p className="chart-card-sub">
        Comparison of baseline (O0) vs optimized (O2) instruction costs
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 4, right: 20, left: 0, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="function"
            angle={-45}
            textAnchor="end"
            height={80}
            tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
          />
          <YAxis
            label={{ value: 'Cost', angle: -90, position: 'insideLeft' }}
            tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ paddingTop: 12, fontSize: 11 }} />
          <Bar dataKey="O0_cost" fill="#60a5fa" name="O0 Baseline" />
          <Bar dataKey="O2_cost" fill="#4ade80" name="O2 Optimized" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
