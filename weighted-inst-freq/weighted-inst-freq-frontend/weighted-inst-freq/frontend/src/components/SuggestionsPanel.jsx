import React, { useMemo } from 'react';

// Maps basic pass recommendations to advanced compiler-engineer tips
const COMPILER_AWARE_MAP = {
  "High memory dominance; review data locality and memory access patterns.": 
    "High memory instruction dominance detected. Optimize spatial and temporal cache locality. Avoid Struct-of-Arrays (SoA) layout overhead, check for pointer aliasing issues (use the 'restrict' qualifier or compile-time metadata), and align variables to 16/32/64-byte boundaries to enable aligned vector load/stores.",

  "Branch-heavy control flow; consider simplifying conditionals or loop exits.": 
    "Complex control flow detected with potential branch mispredictions. Simplify branching logic to allow the compiler to emit branchless select (conditional move) instructions. Structure hot exit paths to be sequential and avoid deeply nested conditions.",

  "High function call overhead; inline hot callees or reduce call frequency.": 
    "Significant overhead from call instructions. Evaluate candidate functions for the 'inline' or 'always_inline' attributes, consider passing arguments by value rather than pointer where appropriate to avoid memory indirection, and enable Link-Time Optimization (LTO) for cross-module boundary optimization.",

  "Nested loops detected; inner-loop optimization may improve performance.": 
    "Nested loop nests found. Prioritize inner-loop optimization: resolve loop-carried dependencies that inhibit SIMD auto-vectorization, minimize inner-loop memory allocations, and review cache stride index ordering to prevent cache line trashing (evaluate loop interchange).",

  "Loops are present; consider loop-invariant motion and unrolling where safe.": 
    "Active loop structures present. Check for Loop-Invariant Code Motion (LICM) candidates to pull computation out of the loop block. Experiment with loop unrolling factors to reduce loop indexing branch overhead in high-iteration loops."
};

function refineSuggestion(text) {
  return COMPILER_AWARE_MAP[text] || text;
}

export default function SuggestionsPanel({ data }) {
  const suggestionsByFn = useMemo(() => {
    if (!data || data.length === 0) return {};
    const map = {};
    data.forEach((fn) => {
      if (fn.suggestions && Array.isArray(fn.suggestions) && fn.suggestions.length > 0) {
        map[fn.function] = fn.suggestions.map(refineSuggestion);
      }
    });
    return map;
  }, [data]);

  const functionNames = useMemo(
    () => Object.keys(suggestionsByFn).sort(),
    [suggestionsByFn]
  );

  if (functionNames.length === 0) {
    return (
      <div className="panel-card animate-in">
        <p className="panel-card-title">// Compiler Optimization Recommendations</p>
        <div className="empty-state">
          <span className="empty-state-icon">💡</span>
          <p className="empty-state-title">No suggestions generated</p>
          <p className="empty-state-sub">Profile results are clean or require no standard loop/memory optimization.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="panel-card animate-in delay-2">
      <p className="panel-card-title">// Compiler Optimization Recommendations</p>
      <p className="panel-card-sub">
        Heuristic heuristics derived from instruction profile topology and LoopInfo analysis:
      </p>
      <div className="suggestions-container">
        {functionNames.map((fn) => (
          <div key={fn} className="suggestion-group">
            <p className="suggestion-fn-name mono">@{fn}</p>
            <ul className="suggestion-list">
              {suggestionsByFn[fn].map((suggestion, i) => (
                <li key={i} className="suggestion-item">
                  <span className="suggestion-bullet">/*</span>
                  <span className="suggestion-text">{suggestion}</span>
                  <span className="suggestion-bullet-end">*/</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
