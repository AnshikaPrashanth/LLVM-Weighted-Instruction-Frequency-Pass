import React from 'react';
import { CATEGORY_COLORS } from '../utils/analysis';

export default function KPICards({ kpis }) {
  const cards = [
    {
      label: 'Functions Analyzed',
      value: kpis.totalFunctions,
      sub: 'unique functions in IR',
      accent: 'var(--green)',
    },
    {
      label: 'Total Weighted Cost',
      value: kpis.totalCost.toFixed(2),
      sub: 'sum of (count × weight)',
      accent: 'var(--blue)',
      mono: true,
    },
    {
      label: 'Hottest Function',
      value: kpis.hottestFn,
      sub: 'highest total cost',
      accent: 'var(--red)',
      mono: true,
    },
    {
      label: 'Highest Cost Category',
      value: kpis.highestCat,
      sub: 'dominant instruction type',
      accent: CATEGORY_COLORS[kpis.highestCat] || 'var(--amber)',
      mono: true,
    },
    {
      label: 'Basic Blocks Analyzed',
      value: kpis.basicBlockCount,
      sub: 'unique (fn, bb) pairs',
      accent: 'var(--purple)',
    },
  ];

  return (
    <div className="kpi-grid">
      {cards.map((c, i) => (
        <div
          key={c.label}
          className={`kpi-card animate-in delay-${i + 1}`}
          style={{ '--card-accent': c.accent }}
        >
          <p className="kpi-label">{c.label}</p>
          <p className={`kpi-value${c.mono ? ' mono' : ''}`}>{c.value}</p>
          <p className="kpi-sub">{c.sub}</p>
        </div>
      ))}
    </div>
  );
}
