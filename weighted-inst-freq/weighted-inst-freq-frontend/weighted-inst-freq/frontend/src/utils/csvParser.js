import Papa from 'papaparse';

/**
 * Parse a CSV string (from file upload or embedded sample) using PapaParse.
 * Returns an array of row objects with numeric fields cast to numbers.
 */
export function parseCSV(csvString) {
  const result = Papa.parse(csvString.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
    transform: (value) => value.trim(),
  });

  if (result.errors && result.errors.length > 0) {
    console.warn('CSV parse warnings:', result.errors);
  }

  // Column Validation
  const required = ['function', 'basic_block', 'group', 'count', 'weight', 'cost', 'pct'];
  const headers = result.meta.fields || [];
  const missing = required.filter(h => !headers.includes(h));
  
  if (missing.length > 0) {
    throw new Error(`Missing required columns: ${missing.join(', ')}.`);
  }

  return result.data.map((row) => ({
    ...row,
    count:  parseFloat(row.count)  || 0,
    weight: parseFloat(row.weight) || 0,
    cost:   parseFloat(row.cost)   || 0,
    pct:    parseFloat(row.pct)    || 0,
  }));
}

/**
 * Parse optimization_delta.csv (O0 vs O2 comparison).
 * Returns array with O0_cost, O2_cost, cost_delta, reduction_pct, loop_severity.
 */
export function parseOptimizationDeltaCSV(csvString) {
  const result = Papa.parse(csvString.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
    transform: (value) => value.trim(),
  });

  if (result.errors && result.errors.length > 0) {
    console.warn('Delta CSV parse warnings:', result.errors);
  }

  // Column Validation
  const required = ['function', 'O0_cost', 'O2_cost', 'cost_delta', 'reduction_pct', 'O0_insts', 'O2_insts', 'inst_delta', 'loop_severity'];
  const headers = result.meta.fields || [];
  const missing = required.filter(h => !headers.includes(h));
  
  if (missing.length > 0) {
    throw new Error(`Missing required columns: ${missing.join(', ')}.`);
  }

  return result.data.map((row) => ({
    ...row,
    O0_cost: parseFloat(row.O0_cost) || 0,
    O2_cost: parseFloat(row.O2_cost) || 0,
    cost_delta: parseFloat(row.cost_delta) || 0,
    reduction_pct: parseFloat(row.reduction_pct) || 0,
    O0_insts: parseInt(row.O0_insts, 10) || 0,
    O2_insts: parseInt(row.O2_insts, 10) || 0,
    inst_delta: parseInt(row.inst_delta, 10) || 0,
  }));
}

/**
 * Parse results.json — extract loop metrics per function.
 * Returns array of function objects with loop_count, max_loop_depth, loop_block_count, loop_severity, suggestions.
 */
export function parseResultsJSON(jsonString) {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed.functions || !Array.isArray(parsed.functions)) {
      console.warn('Invalid JSON structure: expected { functions: [...] }');
      return [];
    }
    return parsed.functions.map((fn) => ({
      function: fn.function || '',
      loop_count: fn.loop_count || 0,
      max_loop_depth: fn.max_loop_depth || 0,
      loop_block_count: fn.loop_block_count || 0,
      loop_severity: fn.loop_severity || 'None',
      suggestions: Array.isArray(fn.suggestions) ? fn.suggestions : [],
    }));
  } catch (e) {
    console.error('Failed to parse JSON:', e.message);
    return [];
  }
}

/**
 * Read a File object as text and return a Promise<string>.
 */
export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}
