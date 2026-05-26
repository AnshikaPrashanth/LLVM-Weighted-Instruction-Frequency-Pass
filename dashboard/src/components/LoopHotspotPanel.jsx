import React from 'react';

const SEVERITY_COLORS = {
  None: '#2a3040',
  Light: '#4ade80',
  Moderate: '#fbbf24',
  Heavy: '#f87171',
};

export default function LoopHotspotPanel({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="panel-card animate-in">
        <p className="panel-card-title">Loop Analysis</p>
        <div className="empty-state">
          <span className="empty-state-icon">🔄</span>
          <p className="empty-state-title">No loop data</p>
          <p className="empty-state-sub">Upload results.json to see loop metrics</p>
        </div>
      </div>
    );
  }

  return (
    <div className="panel-card animate-in delay-2">
      <p className="panel-card-title">Loop Analysis</p>
      <p className="panel-card-sub">
        Per-function loop metrics and severity classification
      </p>
      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>Function</th>
              <th>Loops</th>
              <th>Max Depth</th>
              <th>Loop Blocks</th>
              <th>Severity</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i}>
                <td className="mono">{row.function}</td>
                <td>{row.loop_count}</td>
                <td>{row.max_loop_depth}</td>
                <td>{row.loop_block_count}</td>
                <td>
                  <span
                    className="severity-badge"
                    style={{
                      backgroundColor: SEVERITY_COLORS[row.loop_severity] || '#2a3040',
                      color:
                        row.loop_severity === 'None' || row.loop_severity === 'Heavy'
                          ? '#1a1f28'
                          : '#0d0f12',
                    }}
                  >
                    {row.loop_severity}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
