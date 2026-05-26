# Optional Visualizer

> **This is supplementary.** The core LLVM pass is the main deliverable.

## What it does

Reads `results.csv` (produced by the LLVM pass) and generates a `cost_plot.png` containing:

1. **Stacked bar chart** — weighted cost per function, coloured by instruction category
2. **Pie chart** — overall cost distribution across all categories
3. **Horizontal bar chart** — top basic blocks ranked by weighted cost

## Requirements

```bash
pip install pandas matplotlib
```

## Usage

```bash
# From the project root, first run the pass to generate results.csv, then:
cd optional_visualizer
python3 visualize.py ../results.csv
```

Output: `cost_plot.png` in the current directory.

## Notes

- No web server, no framework, no frontend dependencies.
- Uses `matplotlib` Agg backend — works without a display (headless servers).
- Pass a custom CSV path as the first argument if needed.