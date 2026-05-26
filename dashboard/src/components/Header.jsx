import React from 'react';

export default function Header({ fileName }) {
  const timestamp = new Date().toLocaleString();
  return (
    <header className="header animate-in">
      <div className="header-left">
        <span className="header-badge">LLVM Pass Visualization</span>
        <h1>WeightedInst<span>Freq</span></h1>
        <p className="header-subtitle">
          Instruction Cost Analysis Dashboard · LLVM IR Pass Output Visualizer
        </p>
      </div>
      <div className="header-meta">
        <span className="header-meta-item"><strong>Pass:</strong> -weighted-inst-freq</span>
        <span className="header-meta-item"><strong>Cost formula:</strong> count × weight</span>
        <span className="header-meta-item"><strong>Input:</strong> {fileName || 'results.csv'}</span>
        <button 
          className="btn btn-secondary btn-compact print-btn no-print" 
          onClick={() => window.print()}
          style={{ marginTop: 8 }}
        >
          🖨️ Export PDF Report
        </button>
      </div>

      {/* Print-only audit report header details */}
      <div className="print-only print-report-header" style={{ width: '100%', marginTop: 16, borderTop: '1px solid #ccc', paddingTop: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
          <tbody>
            <tr>
              <td style={{ padding: '4px 0', fontWeight: 'bold' }}>LLVM Compiler Performance Audit Report</td>
              <td style={{ padding: '4px 0', textAlign: 'right', color: '#666' }}>Generated: {timestamp}</td>
            </tr>
            <tr>
              <td style={{ padding: '4px 0' }}>Toolchain: LLVM 14.0.6 (opt-14 / clang-14)</td>
              <td style={{ padding: '4px 0', textAlign: 'right' }}>Target IR Profile: {fileName || 'results.csv'}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </header>
  );
}
