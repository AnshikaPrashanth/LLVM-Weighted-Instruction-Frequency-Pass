import React from 'react';

export default function BasicBlockTable({ rows, selectedBB, onSelectBB }) {
  if (!rows || rows.length === 0) {
    return (
      <div className="table-card animate-in">
        <div className="table-card-header">
          <span className="table-card-title">// Basic Block Cost Breakdown</span>
        </div>
        <div className="empty-state">
          <span className="empty-state-icon">🧱</span>
          <p className="empty-state-title">No basic block data available</p>
          <p className="empty-state-sub">Ensure the CSV contains basic block data.</p>
        </div>
      </div>
    );
  }

  const maxCost = rows[0]?.totalCost || 1;

  return (
    <div className="table-card animate-in delay-2">
      <div className="table-card-header">
        <div>
          <span className="table-card-title">// Basic Block Cost Breakdown</span>
          <p className="table-card-sub-info">Click any block to slice its LLVM IR code in the codestream viewer</p>
        </div>
        <span className="table-card-count">{rows.length} basic blocks · sorted by cost ↓</span>
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Parent Function</th>
              <th>Basic Block</th>
              <th style={{ textAlign: 'right' }}>Weighted Cost</th>
              <th style={{ minWidth: 120 }}>Cost Intensity</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const pct = (r.totalCost / maxCost) * 100;
              const isSelected = selectedBB === `${r.function}||${r.basic_block}`;
              
              return (
                <tr 
                  key={`${r.function}||${r.basic_block}`}
                  onClick={() => onSelectBB?.(r.function, r.basic_block)}
                  className={`clickable-row ${isSelected ? 'row-selected' : ''}`}
                >
                  <td style={{ color: 'var(--text-muted)' }} className="mono">{i + 1}</td>
                  <td className="fn-name mono">@{r.function}</td>
                  <td className="bb-name mono">
                    {isSelected && <span className="selection-arrow">&gt; </span>}
                    {r.basic_block}
                  </td>
                  <td className="cost-val">{r.totalCost.toFixed(2)}</td>
                  <td>
                    <div className="intensity-bar-bg">
                      <div 
                        className="intensity-bar"
                        style={{
                          width: `${pct}%`,
                          background: `hsl(${140 - pct * 1.1}, 60%, 50%)`,
                          transition: 'width 0.4s ease',
                        }} 
                      />
                    </div>
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
