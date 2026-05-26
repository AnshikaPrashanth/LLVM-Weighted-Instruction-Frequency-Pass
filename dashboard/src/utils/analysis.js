export const CATEGORIES = [
  'Arithmetic',
  'Memory',
  'ControlFlow',
  'Call',
  'Cast',
  'Comparison',
  'Other',
];

// Colour palette for categories — consistent across charts
export const CATEGORY_COLORS = {
  Arithmetic:   '#4ade80',
  Memory:       '#60a5fa',
  ControlFlow:  '#fbbf24',
  Call:         '#f87171',
  Cast:         '#a78bfa',
  Comparison:   '#22d3ee',
  Other:        '#64748b',
};

/** Separate function-level rows from basic-block rows. */
export function splitRows(rows) {
  if (!rows || !Array.isArray(rows)) return { fnRows: [], bbRows: [] };
  const fnRows = rows.filter((r) => r && r.basic_block === 'FUNCTION_TOTAL');
  const bbRows = rows.filter((r) => r && r.basic_block !== 'FUNCTION_TOTAL');
  return { fnRows, bbRows };
}

/** Get sorted unique function names from function-level rows. */
export function getFunctionNames(fnRows) {
  if (!fnRows || !Array.isArray(fnRows)) return [];
  return [...new Set(fnRows.map((r) => r && r.function).filter(Boolean))].sort();
}

/**
 * Build per-function summary objects.
 * Returns array of:
 *   { function, totalCost, categoryCosts: {Arithmetic: x, ...}, dominantCategory, dominantPct }
 */
export function buildFunctionSummaries(fnRows) {
  if (!fnRows || !Array.isArray(fnRows)) return [];
  const map = {};

  fnRows.forEach((row) => {
    if (!row) return;
    const fn = row.function;
    if (!fn) return;
    if (!map[fn]) {
      map[fn] = { function: fn, totalCost: 0, categoryCosts: {} };
      CATEGORIES.forEach((c) => { map[fn].categoryCosts[c] = 0; });
    }
    const cat = row.group;
    if (CATEGORIES.includes(cat)) {
      map[fn].categoryCosts[cat] = (map[fn].categoryCosts[cat] || 0) + row.cost;
    }
    map[fn].totalCost += row.cost;
  });

  return Object.values(map).map((fn) => {
    let domCat = 'Other';
    let domCost = -1;
    CATEGORIES.forEach((c) => {
      if (fn.categoryCosts[c] > domCost) {
        domCost = fn.categoryCosts[c];
        domCat = c;
      }
    });
    const dominantPct = fn.totalCost > 0 ? (domCost / fn.totalCost) * 100 : 0;
    return { ...fn, dominantCategory: domCat, dominantPct };
  });
}

/**
 * Build data for the stacked bar chart.
 * Each entry: { function: 'foo', Arithmetic: 2, Memory: 57, ... }
 */
export function buildStackedBarData(fnSummaries) {
  if (!fnSummaries || !Array.isArray(fnSummaries)) return [];
  return fnSummaries.map((s) => ({
    function: s.function,
    ...s.categoryCosts,
    totalCost: s.totalCost,
  }));
}

/**
 * Build pie chart data: overall cost distribution across categories
 * using function-level rows.
 */
export function buildPieData(fnRows) {
  if (!fnRows || !Array.isArray(fnRows)) return [];
  const totals = {};
  CATEGORIES.forEach((c) => { totals[c] = 0; });

  fnRows.forEach((row) => {
    if (row && CATEGORIES.includes(row.group)) {
      totals[row.group] += row.cost;
    }
  });

  return CATEGORIES
    .filter((c) => totals[c] > 0)
    .map((c) => ({ name: c, value: totals[c], fill: CATEGORY_COLORS[c] }));
}

/**
 * Build hotspot table rows from function summaries.
 * threshold: number — functions with totalCost >= threshold are HOTSPOTs.
 */
export function buildHotspotRows(fnSummaries, threshold) {
  if (!fnSummaries || !Array.isArray(fnSummaries)) return [];
  return fnSummaries
    .map((s) => ({
      ...s,
      isHotspot: s.totalCost >= threshold,
    }))
    .sort((a, b) => b.totalCost - a.totalCost);
}

/**
 * Build basic-block table rows.
 * Groups bbRows by (function, basic_block) and sums cost.
 */
export function buildBBRows(bbRows) {
  const map = {};

  bbRows.forEach((row) => {
    const key = `${row.function}||${row.basic_block}`;
    if (!map[key]) {
      map[key] = { function: row.function, basic_block: row.basic_block, totalCost: 0 };
    }
    map[key].totalCost += row.cost;
  });

  return Object.values(map).sort((a, b) => b.totalCost - a.totalCost);
}

/** Compute KPI values. */
export function computeKPIs(fnSummaries, bbRows) {
  const totalFunctions = fnSummaries.length;
  const totalCost = fnSummaries.reduce((s, f) => s + f.totalCost, 0);

  const hottestFn = fnSummaries.reduce(
    (best, f) => (f.totalCost > (best?.totalCost ?? -1) ? f : best),
    null
  );

  // Highest cost category (sum across all functions)
  const catTotals = {};
  CATEGORIES.forEach((c) => { catTotals[c] = 0; });
  fnSummaries.forEach((s) => {
    CATEGORIES.forEach((c) => { catTotals[c] += s.categoryCosts[c] || 0; });
  });
  const highestCat = CATEGORIES.reduce((best, c) =>
    catTotals[c] > (catTotals[best] ?? -1) ? c : best,
    CATEGORIES[0]
  );

  // Count unique (function, basic_block) pairs
  const bbSet = new Set(bbRows.map((r) => `${r.function}||${r.basic_block}`));

  return {
    totalFunctions,
    totalCost: Math.round(totalCost * 100) / 100,
    hottestFn: hottestFn?.function ?? '—',
    highestCat,
    basicBlockCount: bbSet.size,
  };
}

/** Filter function summaries by selected function name ('All' = no filter). */
export function filterByFunction(summaries, selectedFn) {
  if (!selectedFn || selectedFn === 'All') return summaries;
  return summaries.filter((s) => s.function === selectedFn);
}

/** Filter basic block rows by selected function. */
export function filterBBByFunction(bbRows, selectedFn) {
  if (!selectedFn || selectedFn === 'All') return bbRows;
  return bbRows.filter((r) => r.function === selectedFn);
}

/**
 * Build optimization comparison chart data from delta CSV rows.
 * Expects: { function, O0_cost, O2_cost, reduction_pct, loop_severity }
 */
export function buildOptimizationChartData(deltaRows) {
  if (!Array.isArray(deltaRows)) return [];
  return deltaRows.map((r) => ({
    function: r.function || '',
    O0_cost: parseFloat(r.O0_cost) || 0,
    O2_cost: parseFloat(r.O2_cost) || 0,
    reduction_pct: parseFloat(r.reduction_pct) || 0,
  }));
}

/**
 * Build severity distribution chart data from JSON functions.
 * Returns pie chart format: { name, value: count, fill: color, count }
 */
export function buildSeverityDistributionData(jsonFunctions) {
  if (!Array.isArray(jsonFunctions)) return [];

  const severityCounts = { None: 0, Light: 0, Moderate: 0, Heavy: 0 };
  jsonFunctions.forEach((fn) => {
    const sev = fn.loop_severity || 'None';
    if (sev in severityCounts) severityCounts[sev]++;
  });

  const severityColors = {
    None: '#2a3040',
    Light: '#4ade80',
    Moderate: '#fbbf24',
    Heavy: '#f87171',
  };

  return Object.entries(severityCounts)
    .filter(([_, count]) => count > 0)
    .map(([severity, count]) => ({
      name: severity,
      value: count / jsonFunctions.length,
      count,
      fill: severityColors[severity] || '#2a3040',
    }));
}

