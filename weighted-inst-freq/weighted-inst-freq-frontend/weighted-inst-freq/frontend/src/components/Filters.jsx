import React from 'react';

export default function Filters({ functions, filters, onChange }) {
  return (
    <div className="filters-bar animate-in">
      <div className="filter-group">
        <label className="filter-label">Function</label>
        <select
          className="filter-select"
          value={filters.selectedFn}
          onChange={(e) => onChange({ ...filters, selectedFn: e.target.value })}
        >
          <option value="All">All Functions</option>
          {functions.map((fn) => (
            <option key={fn} value={fn}>{fn}</option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <label className="filter-label">Category</label>
        <select
          className="filter-select"
          value={filters.selectedCat}
          onChange={(e) => onChange({ ...filters, selectedCat: e.target.value })}
        >
          <option value="All">All Categories</option>
          {['Arithmetic', 'Memory', 'ControlFlow', 'Call', 'Cast', 'Comparison', 'Other'].map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <label className="filter-label">Hotspot Threshold</label>
        <input
          className="filter-input"
          type="number"
          min="0"
          step="1"
          value={filters.threshold}
          onChange={(e) => onChange({ ...filters, threshold: parseFloat(e.target.value) || 0 })}
        />
      </div>

      <div className="filter-group">
        <label className="filter-label">&nbsp;</label>
        <span className="threshold-badge">
          ⚠ ≥ {filters.threshold} cost = HOTSPOT
        </span>
      </div>
    </div>
  );
}
