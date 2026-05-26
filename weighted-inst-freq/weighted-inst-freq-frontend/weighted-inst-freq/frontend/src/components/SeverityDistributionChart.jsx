import React from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip,
} from 'recharts';

const SEVERITY_COLORS = {
  None: '#2a3040',
  Light: '#4ade80',
  Moderate: '#fbbf24',
  Heavy: '#f87171',
};

function CustomTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const { name, value, count } = payload[0].payload;
  const pct = (value * 100).toFixed(1);
  return (
    <div className="custom-tooltip">
      <p className="custom-tooltip-label">{name}</p>
      <div className="custom-tooltip-row">
        <span className="custom-tooltip-key">Functions:</span>
        <span className="custom-tooltip-val">{count}</span>
      </div>
      <div className="custom-tooltip-row">
        <span className="custom-tooltip-key">Share:</span>
        <span className="custom-tooltip-val">{pct}%</span>
      </div>
    </div>
  );
}

export default function SeverityDistributionChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="chart-card animate-in">
        <p className="chart-card-title">Severity Distribution</p>
        <div className="empty-state">
          <span className="empty-state-icon">🎯</span>
          <p className="empty-state-title">No severity data</p>
          <p className="empty-state-sub">Upload results.json to see distribution</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chart-card animate-in delay-2">
      <p className="chart-card-title">Severity Distribution</p>
      <p className="chart-card-sub">
        Functions classified by loop analysis severity level
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ paddingTop: 12, fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
