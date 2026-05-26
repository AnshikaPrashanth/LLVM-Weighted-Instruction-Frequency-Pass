import React, { useState, useMemo, useEffect } from 'react';

import Header from './components/Header';
import FileUpload from './components/FileUpload';
import KPICards from './components/KPICards';
import Filters from './components/Filters';
import FunctionCostChart from './components/FunctionCostChart';
import CategoryPieChart from './components/CategoryPieChart';
import HotspotTable from './components/HotspotTable';
import BasicBlockTable from './components/BasicBlockTable';
import ExplanationPanel from './components/ExplanationPanel';

// Supplemental Components
import LoopHotspotPanel from './components/LoopHotspotPanel';
import OptimizationComparisonChart from './components/OptimizationComparisonChart';
import SeverityDistributionChart from './components/SeverityDistributionChart';
import SuggestionsPanel from './components/SuggestionsPanel';
import MetadataPanel from './components/MetadataPanel';
import IRInsightPanel from './components/IRInsightPanel';

import {
  splitRows,
  getFunctionNames,
  buildFunctionSummaries,
  buildStackedBarData,
  buildPieData,
  buildHotspotRows,
  buildBBRows,
  computeKPIs,
  filterByFunction,
  filterBBByFunction,
  buildOptimizationChartData,
  buildSeverityDistributionData,
} from './utils/analysis';

import {
  parseCSV,
  parseResultsJSON,
  parseOptimizationDeltaCSV
} from './utils/csvParser';

export default function App() {
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    selectedFn: 'All',
    selectedCat: 'All',
    threshold: 30,
  });
  const [supplementalData, setSupplementalData] = useState({
    deltaCSV: null,
    resultsJSON: null,
  });

  // Selected IR code context for codestream viewer
  const [selectedFn, setSelectedFn] = useState('sum_array');
  const [selectedBB, setSelectedBB] = useState(null);

  // Sync selection state with function filters
  useEffect(() => {
    if (filters.selectedFn !== 'All') {
      setSelectedFn(filters.selectedFn);
      setSelectedBB(null);
    }
  }, [filters.selectedFn]);

  function handleDataLoaded(parsedRows, name) {
    setRows(parsedRows);
    setFileName(name);
    setError(null);
    setFilters((f) => ({ ...f, selectedFn: 'All', selectedCat: 'All' }));
  }

  function handleSupplementalDataLoaded(data) {
    setSupplementalData((prev) => ({ ...prev, ...data }));
  }

  function handleClear() {
    setRows([]);
    setFileName('');
    setError(null);
    setSupplementalData({ deltaCSV: null, resultsJSON: null });
  }

  // Auto-load default files from public directory if available
  useEffect(() => {
    async function loadDefaultFiles() {
      try {
        const csvRes = await fetch('/results.csv');
        if (csvRes.ok) {
          const csvText = await csvRes.text();
          const parsedRows = parseCSV(csvText);
          handleDataLoaded(parsedRows, 'results.csv');

          // Attempt to load summary.json (as resultsJSON)
          const jsonRes = await fetch('/summary.json');
          if (jsonRes.ok) {
            const jsonText = await jsonRes.text();
            const jsonData = parseResultsJSON(jsonText);
            if (jsonData && jsonData.length > 0) {
              setSupplementalData((prev) => ({ ...prev, resultsJSON: jsonData }));
            }
          }

          // Attempt to load optimization_comparison_delta.csv (as deltaCSV)
          const deltaRes = await fetch('/optimization_comparison_delta.csv');
          if (deltaRes.ok) {
            const deltaText = await deltaRes.text();
            const deltaRows = parseOptimizationDeltaCSV(deltaText);
            if (deltaRows && deltaRows.length > 0) {
              setSupplementalData((prev) => ({ ...prev, deltaCSV: deltaRows }));
            }
          }
        }
      } catch (err) {
        console.warn('Auto-load warnings:', err);
        setError(err.message || 'Auto-load failed. Please check the CSV/JSON schemas.');
      }
    }
    loadDefaultFiles();
  }, []);

  // --- Derived data ---
  const { fnRows, bbRows } = useMemo(() => splitRows(rows), [rows]);
  const functionNames = useMemo(() => getFunctionNames(fnRows), [fnRows]);

  // Default function selection on load
  useEffect(() => {
    if (functionNames && functionNames.length > 0) {
      if (functionNames.includes('sum_array')) {
        setSelectedFn('sum_array');
      } else {
        setSelectedFn(functionNames[0]);
      }
    }
  }, [functionNames]);

  // Filter function-level rows by selectedFn
  const filteredFnRows = useMemo(() => {
    let r = fnRows;
    if (filters.selectedFn !== 'All') r = r.filter((row) => row.function === filters.selectedFn);
    if (filters.selectedCat !== 'All') r = r.filter((row) => row.group === filters.selectedCat);
    return r;
  }, [fnRows, filters.selectedFn, filters.selectedCat]);

  // All summaries (unfiltered by category — used for KPIs and hotspot)
  const fnSummariesAll = useMemo(() => buildFunctionSummaries(fnRows), [fnRows]);

  // Summaries filtered by selectedFn only (for charts & hotspot table)
  const fnSummariesFiltered = useMemo(() => {
    const base = filterByFunction(fnSummariesAll, filters.selectedFn);
    return base;
  }, [fnSummariesAll, filters.selectedFn]);

  // Stacked bar: filtered by function, but always show all categories
  const barData = useMemo(() => buildStackedBarData(fnSummariesFiltered), [fnSummariesFiltered]);

  // Pie: use filteredFnRows (respects both fn and category filters)
  const pieData = useMemo(() => buildPieData(filteredFnRows), [filteredFnRows]);

  // Hotspot table
  const hotspotRows = useMemo(
    () => buildHotspotRows(fnSummariesFiltered, filters.threshold),
    [fnSummariesFiltered, filters.threshold]
  );

  // Basic block table
  const filteredBBRows = useMemo(() => {
    const filtered = filterBBByFunction(bbRows, filters.selectedFn);
    return buildBBRows(filtered);
  }, [bbRows, filters.selectedFn]);

  // KPIs — always from all function-level data (not filtered)
  const kpis = useMemo(() => computeKPIs(fnSummariesAll, bbRows), [fnSummariesAll, bbRows]);

  const hasData = rows.length > 0;

  return (
    <div className="app">
      <Header fileName={fileName} />

      {error && (
        <div className="panel-card error-banner animate-in no-print" style={{ marginBottom: 24, borderLeft: '3px solid var(--red)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 18, color: 'var(--red)' }}>⚠</span>
              <div>
                <p style={{ fontWeight: 'bold', color: 'var(--text-primary)', margin: 0 }}>LLVM Toolchain Parse Failure</p>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>{error}</p>
              </div>
            </div>
            <button className="btn btn-ghost" onClick={() => setError(null)} style={{ padding: 4 }}>✕</button>
          </div>
        </div>
      )}

      <div className="no-print">
        <FileUpload
          onDataLoaded={handleDataLoaded}
          loadedFileName={fileName}
          onClear={handleClear}
          onSupplementalDataLoaded={handleSupplementalDataLoaded}
        />
      </div>

      {hasData && (
        <>
          <MetadataPanel kpis={kpis} resultsJSON={supplementalData.resultsJSON} />

          <p className="section-title animate-in">Key Metrics</p>
          <KPICards kpis={kpis} />

          <p className="section-title animate-in no-print">Filters</p>
          <div className="no-print">
            <Filters
              functions={functionNames}
              filters={filters}
              onChange={setFilters}
            />
          </div>

          <p className="section-title animate-in">Cost Analysis</p>
          <div className="charts-grid">
            <FunctionCostChart data={barData} />
            <CategoryPieChart data={pieData} />
          </div>

          {(supplementalData.deltaCSV || supplementalData.resultsJSON) && (
            <>
              <p className="section-title animate-in">Optimization & Loop Analysis</p>
              <div className="charts-grid">
                {supplementalData.deltaCSV && (
                  <OptimizationComparisonChart data={buildOptimizationChartData(supplementalData.deltaCSV)} />
                )}
                {supplementalData.resultsJSON && (
                  <SeverityDistributionChart data={buildSeverityDistributionData(supplementalData.resultsJSON)} />
                )}
              </div>
            </>
          )}

          {supplementalData.resultsJSON && (
            <>
              <p className="section-title animate-in">Loop Details</p>
              <LoopHotspotPanel data={supplementalData.resultsJSON} />
            </>
          )}

          <p className="section-title animate-in">Hotspot Detection</p>
          <HotspotTable 
            rows={hotspotRows} 
            selectedFn={selectedFn} 
            onSelectFn={setSelectedFn} 
          />

          <p className="section-title animate-in">Basic Block Detail</p>
          <BasicBlockTable 
            rows={filteredBBRows} 
            selectedBB={selectedBB}
            onSelectBB={(fn, bb) => {
              setSelectedFn(fn);
              setSelectedBB(`${fn}||${bb}`);
            }}
          />

          <p className="section-title animate-in no-print">LLVM IR Code Insight</p>
          <div className="no-print">
            <IRInsightPanel 
              selectedFn={selectedFn} 
              selectedBB={selectedBB} 
            />
          </div>

          {supplementalData.resultsJSON && (
            <>
              <p className="section-title animate-in">Optimization Suggestions</p>
              <SuggestionsPanel data={supplementalData.resultsJSON} />
            </>
          )}

          <div className="divider no-print" />
        </>
      )}

      <div className="no-print">
        <p className="section-title">About</p>
        <ExplanationPanel />

        <footer className="footer">
          <p className="footer-note">
            <strong>LLVM Weighted Instruction Frequency Pass Visualization</strong>
          </p>
          <div className="footer-right">
            <span className="footer-tag">React + Vite</span>
            <span className="footer-tag">Recharts</span>
            <span className="footer-tag">PapaParse</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
