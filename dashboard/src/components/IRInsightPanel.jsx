import React, { useEffect, useState, useMemo } from 'react';

// Simple parser for LLVM IR
function parseLLVMIR(text) {
  const functions = {};
  const basicBlocks = {};
  const lines = text.split('\n');
  
  let currentFn = null;
  let currentFnLines = [];
  let currentBB = null;
  let currentBBLines = [];
  let bbIndex = 0;
  
  lines.forEach((line) => {
    const trimmed = line.trim();
    
    // Detect function start
    if (trimmed.startsWith('define ') && trimmed.includes('@')) {
      const match = trimmed.match(/@([a-zA-Z0-9_]+)\s*\(/);
      if (match) {
        currentFn = match[1];
        currentFnLines = [line];
        currentBB = 'BB0'; // First block is entry, we label it BB0
        currentBBLines = [];
        bbIndex = 0;
      }
    } else if (currentFn) {
      currentFnLines.push(line);
      
      // Detect basic block start (label like "7:" or "for.cond:")
      const isLabel = line.match(/^([a-zA-Z0-9_\.]+):\s*(;.*)?$/) || line.match(/^(\d+):\s*(;.*)?$/);
      if (isLabel) {
        // Save previous block
        if (currentBB && currentBBLines.length > 0) {
          basicBlocks[`${currentFn}||${currentBB}`] = currentBBLines.join('\n');
        }
        bbIndex++;
        currentBB = 'BB' + bbIndex;
        currentBBLines = [line];
      } else {
        if (trimmed !== '}') {
          currentBBLines.push(line);
        }
      }
      
      // Detect function end
      if (trimmed === '}') {
        if (currentBB && currentBBLines.length > 0) {
          basicBlocks[`${currentFn}||${currentBB}`] = currentBBLines.join('\n');
        }
        functions[currentFn] = currentFnLines.join('\n');
        currentFn = null;
      }
    }
  });
  
  return { functions, basicBlocks };
}

// Light custom LLVM IR syntax highlighting
function highlightIR(code) {
  if (!code) return '';
  
  // Escape HTML
  let escaped = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
    
  let id = 0;
  const placeholders = {};
  
  // 1. Comments
  escaped = escaped.replace(/(;.*)$/gm, (match) => {
    const key = `___PLACEHOLDER_${id++}___`;
    placeholders[key] = `<span class="ir-comment">${match}</span>`;
    return key;
  });

  // 2. Globals (@name)
  escaped = escaped.replace(/(@[a-zA-Z0-9_\.]+)/g, (match) => {
    const key = `___PLACEHOLDER_${id++}___`;
    placeholders[key] = `<span class="ir-global">${match}</span>`;
    return key;
  });

  // 3. Registers (%name)
  escaped = escaped.replace(/(%[a-zA-Z0-9_\.]+)/g, (match) => {
    const key = `___PLACEHOLDER_${id++}___`;
    placeholders[key] = `<span class="ir-register">${match}</span>`;
    return key;
  });

  // 4. Metadata (!name)
  escaped = escaped.replace(/(![a-zA-Z0-9_\.]+)/g, (match) => {
    const key = `___PLACEHOLDER_${id++}___`;
    placeholders[key] = `<span class="ir-metadata">${match}</span>`;
    return key;
  });

  // 5. Opcodes / Keywords
  escaped = escaped.replace(/\b(define|declare|ret|br|alloca|load|store|getelementptr|add|sub|mul|sdiv|udiv|fadd|fsub|fmul|fdiv|icmp|fcmp|sext|trunc|zext|bitcast|call|invoke|phi|select|align|noundef|dso_local|inbounds|private|unnamed_addr|constant|private)\b/g, (match) => {
    const key = `___PLACEHOLDER_${id++}___`;
    placeholders[key] = `<span class="ir-keyword">${match}</span>`;
    return key;
  });

  // 6. Types
  escaped = escaped.replace(/\b(i\d+|double|float|ptr|void|label)\b/g, (match) => {
    const key = `___PLACEHOLDER_${id++}___`;
    placeholders[key] = `<span class="ir-type">${match}</span>`;
    return key;
  });
  
  // Restore placeholders
  let restored = escaped;
  let loopCount = 0;
  while (restored.includes('___PLACEHOLDER_') && loopCount < 100) {
    Object.entries(placeholders).forEach(([key, val]) => {
      restored = restored.replace(key, val);
    });
    loopCount++;
  }
  
  return restored;
}

export default function IRInsightPanel({ selectedFn, selectedBB }) {
  const [irData, setIrData] = useState({ functions: {}, basicBlocks: {} });
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('function'); // 'function' or 'bb'

  useEffect(() => {
    async function fetchIR() {
      try {
        const res = await fetch('/test.ll');
        if (res.ok) {
          const text = await res.text();
          const parsed = parseLLVMIR(text);
          setIrData(parsed);
        }
      } catch (e) {
        console.error('Failed to load test.ll', e);
      } finally {
        setLoading(false);
      }
    }
    fetchIR();
  }, []);

  const hasData = Object.keys(irData.functions).length > 0;

  // Sync view mode and display target code
  const currentTarget = useMemo(() => {
    if (!hasData) return null;
    
    const fnName = selectedFn === 'All' ? 'sum_array' : selectedFn;
    
    if (viewMode === 'bb' && selectedBB) {
      const key = selectedBB.includes('||') ? selectedBB : `${fnName}||${selectedBB}`;
      return {
        title: `Basic Block: ${key.split('||')[1]} (${key.split('||')[0]})`,
        code: irData.basicBlocks[key] || '; No IR available for this basic block block.'
      };
    }

    return {
      title: `Function: @${fnName}`,
      code: irData.functions[fnName] || '; No IR available for this function.'
    };
  }, [irData, selectedFn, selectedBB, viewMode, hasData]);

  const highlightedHtml = useMemo(() => {
    if (!currentTarget) return '';
    return highlightIR(currentTarget.code);
  }, [currentTarget]);

  if (loading) {
    return (
      <div className="panel-card ir-panel animate-in">
        <p className="panel-card-title">LLVM IR Insight Viewer</p>
        <div className="skeleton-container">
          <div className="skeleton-line" style={{ width: '40%' }}></div>
          <div className="skeleton-block" style={{ height: 160 }}></div>
        </div>
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="panel-card ir-panel animate-in">
        <p className="panel-card-title">LLVM IR Insight Viewer</p>
        <div className="empty-state">
          <span className="empty-state-icon">📄</span>
          <p className="empty-state-title">LLVM IR Not Loaded</p>
          <p className="empty-state-sub">Run run.sh to generate test.ll and copy it to the public directory.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="panel-card ir-panel animate-in delay-2">
      <div className="ir-panel-header">
        <div>
          <p className="panel-card-title">// LLVM IR CODESTREAM PROFILER</p>
          <p className="panel-card-sub">{currentTarget?.title}</p>
        </div>
        <div className="ir-toggle-buttons">
          <button 
            className={`btn btn-toggle ${viewMode === 'function' ? 'active' : ''}`}
            onClick={() => setViewMode('function')}
          >
            Function IR
          </button>
          <button 
            className={`btn btn-toggle ${viewMode === 'bb' ? 'active' : ''}`}
            onClick={() => setViewMode('bb')}
            disabled={selectedFn === 'All' && !selectedBB}
          >
            BB Slice
          </button>
        </div>
      </div>
      <div className="ir-code-wrapper">
        <pre className="ir-pre">
          <code 
            className="ir-code"
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />
        </pre>
      </div>
    </div>
  );
}
