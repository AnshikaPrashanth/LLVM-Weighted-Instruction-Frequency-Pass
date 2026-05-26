import React from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from 'recharts';

function CustomTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0];
  return (
    <div className="custom-tooltip">
      <p className="custom-tooltip-label">{d.name}</p>
      <div className="custom-tooltip-row">
        <span className="custom-tooltip-key">Weighted Cost</span>
        <span className="custom-tooltip-val">{d.value.toFixed(2)}</span>
      </div>
      <div className="custom-tooltip-row">
        <span className="custom-tooltip-key">Share</span>
        <span className="custom-tooltip-val">
          {(d.payload.percent * 100).toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

function CustomLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text
      x={x} y={y}
      fill="rgba(255,255,255,0.85)"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={10}
      fontFamily="var(--font-mono)"
      fontWeight="600"
    >
      {(percent * 100).toFixed(0)}%
    </text>
  );
}

export default function CategoryPieChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="chart-card animate-in delay-2">
        <p className="chart-card-title">Category Distribution</p>
        <div className="empty-state">
          <span className="empty-state-icon">🥧</span>
          <p className="empty-state-title">No data</p>
        </div>
      </div>
    );
  }

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="chart-card animate-in delay-2">
      <p className="chart-card-title">Category Distribution</p>
      <p className="chart-card-sub">Overall cost share by instruction type</p>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={100}
            dataKey="value"
            paddingAngle={2}
            labelLine={false}
            label={CustomLabel}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.fill} stroke="var(--bg-card)" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="chart-legend">
        {data.map((d) => (
          <span className="legend-item" key={d.name}>
            <span className="legend-dot" style={{ background: d.fill }} />
            {d.name}
            <span style={{ color: 'var(--text-muted)', marginLeft: 3 }}>
              {((d.value / total) * 100).toFixed(1)}%
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
