import React from 'react';
import { CATEGORY_COLORS } from '../utils/analysis';

export default function HotspotTable({ rows, selectedFn, onSelectFn }) {
  if (!rows || rows.length === 0) {
    return (
      <div className="table-card animate-in">
        <div className="table-card-header">
          <span className="table-card-title">// Hotspot Analysis</span>
        </div>
        <div className="empty-state">
          <span className="empty-state-icon">🔥</span>
          <p className="empty-state-title">No hotspot data available</p>
        </div>
      </div>
    );
  }

  const hotCount = rows.filter((r) => r.isHotspot).length;

  return (
    <div className="table-card animate-in delay-1">
      <div className="table-card-header">
        <div>
          <span className="table-card-title">// Hotspot Analysis</span>
          <p className="table-card-sub-info">Click a function to profile its LLVM IR code below</p>
        </div>
        <span className="table-card-count">
          {hotCount} hotspot{hotCount !== 1 ? 's' : ''} / {rows.length} functions
        </span>
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Function Signature</th>
              <th style={{ textAlign: 'right' }}>Weighted Cost</th>
              <th>Dominant Category</th>
              <th style={{ textAlign: 'right' }}>Dom. Share</th>
              <th>Severity Level</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              // Determine severity badge
              let severityLabel = 'Normal';
              let badgeClass = 'badge-normal';
              if (r.isHotspot) {
                if (r.totalCost >= 150) {
                  severityLabel = 'Severe';
                  badgeClass = 'badge-severe';
                } else if (r.totalCost >= 60) {
                  severityLabel = 'Moderate';
                  badgeClass = 'badge-moderate';
                } else {
                  severityLabel = 'Mild';
                  badgeClass = 'badge-mild';
                }
              }

              // Compute heat color opacity (subtle crimson backglow)
              const heatOpacity = r.isHotspot ? Math.min(0.08, r.totalCost / 2000) : 0;
              const rowStyle = r.isHotspot 
                ? { backgroundColor: `rgba(248, 113, 113, ${heatOpacity})` } 
                : {};

              const isSelected = selectedFn === r.function;

              return (
                <tr 
                  key={r.function}
                  onClick={() => onSelectFn?.(r.function)}
                  className={`clickable-row ${isSelected ? 'row-selected' : ''}`}
                  style={rowStyle}
                >
                  <td className="fn-name mono">
                    {isSelected && <span className="selection-arrow">&gt; </span>}
                    @{r.function}
                  </td>
                  <td className="cost-val">{r.totalCost.toFixed(2)}</td>
                  <td>
                    <span
                      className="cat-tag"
                      style={{
                        background: CATEGORY_COLORS[r.dominantCategory] + '12',
                        color: CATEGORY_COLORS[r.dominantCategory],
                        border: `1px solid ${CATEGORY_COLORS[r.dominantCategory]}22`,
                      }}
                    >
                      {r.dominantCategory}
                    </span>
                  </td>
                  <td className="pct-val">{r.dominantPct.toFixed(1)}%</td>
                  <td>
                    <span className={`badge ${badgeClass}`}>
                      {severityLabel}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
