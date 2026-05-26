import React, { useRef, useState } from 'react';
import { readFileAsText, parseCSV, parseOptimizationDeltaCSV, parseResultsJSON } from '../utils/csvParser';
import { SAMPLE_CSV, SAMPLE_FILE_NAME } from '../data/sampleData';

export default function FileUpload({ onDataLoaded, loadedFileName, onClear, onSupplementalDataLoaded }) {
  const inputRef = useRef(null);
  const supplementalInputRef = useRef(null);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState('');
  const [supplementalFiles, setSupplementalFiles] = useState({});

  async function processFile(file) {
    if (!file) return;
    if (!file.name.endsWith('.csv')) {
      setError('Please upload a .csv file.');
      return;
    }
    setError('');
    try {
      const text = await readFileAsText(file);
      const rows = parseCSV(text);
      onDataLoaded(rows, file.name);
    } catch (e) {
      setError('Failed to parse CSV: ' + e.message);
    }
  }

  async function processSupplementalFile(file) {
    if (!file) return;

    setError('');
    try {
      const text = await readFileAsText(file);
      const fileName = file.name.toLowerCase();

      if (fileName.includes('_delta') || fileName.includes('optimization')) {
        if (!fileName.endsWith('.csv')) {
          setError('Optimization file must be .csv');
          return;
        }
        const deltaRows = parseOptimizationDeltaCSV(text);
        setSupplementalFiles((prev) => ({ ...prev, deltaCSV: deltaRows }));
        onSupplementalDataLoaded?.({ deltaCSV: deltaRows });
      } else if (fileName.endsWith('.json')) {
        const jsonData = parseResultsJSON(text);
        setSupplementalFiles((prev) => ({ ...prev, resultsJSON: jsonData }));
        onSupplementalDataLoaded?.({ resultsJSON: jsonData });
      } else {
        setError('File not recognized. Expected optimization_delta.csv, results.json, or summary.json');
      }
    } catch (e) {
      setError('Failed to parse supplemental file: ' + e.message);
    }
  }

  function handleFileChange(e) {
    processFile(e.target.files[0]);
    e.target.value = '';
  }

  function handleSupplementalFileChange(e) {
    processSupplementalFile(e.target.files[0]);
    e.target.value = '';
  }

  function handleDrop(e) {
    e.preventDefault();
    setDrag(false);
    processFile(e.dataTransfer.files[0]);
  }

  function loadSample() {
    const rows = parseCSV(SAMPLE_CSV);
    onDataLoaded(rows, SAMPLE_FILE_NAME);
  }

  const supplementalStatus = Object.keys(supplementalFiles).length > 0 ? (
    <div style={{ marginTop: 12 }}>
      <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>
        Supplemental data loaded:
      </p>
      {supplementalFiles.deltaCSV && (
        <p style={{ fontSize: 11, color: 'var(--green)' }}>✓ optimization_delta.csv</p>
      )}
      {supplementalFiles.resultsJSON && (
        <p style={{ fontSize: 11, color: 'var(--green)' }}>✓ results.json</p>
      )}
    </div>
  ) : null;

  if (loadedFileName) {
    return (
      <div className="animate-in">
        <div className="loaded-file-info animate-in">
          <span className="loaded-file-dot">●</span>
          <span className="loaded-file-name">{loadedFileName}</span>
          <span className="loaded-file-meta">loaded &amp; parsed</span>
          <button className="btn btn-ghost" onClick={onClear}>✕ Clear</button>
        </div>
        <div style={{ marginTop: 16 }}>
          <p className="section-title" style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
            Optional: Load Supplemental Data
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              className="btn btn-secondary"
              style={{ fontSize: 11 }}
              onClick={() => supplementalInputRef.current.click()}
            >
              📊 Upload optimization_delta.csv
            </button>
            <button
              className="btn btn-secondary"
              style={{ fontSize: 11 }}
              onClick={() => supplementalInputRef.current.click()}
            >
              📋 Upload results.json
            </button>
          </div>
          {supplementalStatus}
          <input
            ref={supplementalInputRef}
            type="file"
            accept=".csv,.json"
            className="file-input-hidden"
            onChange={handleSupplementalFileChange}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in delay-1">
      <p className="section-title">Data Source</p>
      <div
        className={`upload-zone${drag ? ' drag-over' : ''}`}
        onClick={() => inputRef.current.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={handleDrop}
      >
        <span className="upload-icon">📂</span>
        <p className="upload-title">Upload results.csv</p>
        <p className="upload-sub">
          Drop your <code>results.csv</code> here or click to browse.
          Generated by the LLVM pass.
        </p>
        <div className="upload-actions" onClick={(e) => e.stopPropagation()}>
          <button className="btn btn-primary" onClick={() => inputRef.current.click()}>
            ↑ Upload CSV
          </button>
          <button className="btn btn-secondary" onClick={loadSample}>
            ⚡ Load Sample Data
          </button>
        </div>
        {error && (
          <p style={{ color: 'var(--red)', marginTop: 12, fontSize: 12 }}>{error}</p>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="file-input-hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}

