# Weighted Instruction Frequency LLVM Pass

> **Academic Project — LLVM 14 · Legacy Pass Manager · C++17**

---

## Overview

This project implements a **custom LLVM analysis pass** that statically analyses LLVM IR (Intermediate Representation) and computes **weighted instruction frequency** for every function and basic block.

Rather than counting all instructions equally, the pass assigns **configurable cost weights** to instruction categories (Arithmetic, Memory, ControlFlow, Call, Cast, Comparison, Other). This produces a realistic cost estimate that reflects actual hardware behaviour — for example, a function call or a memory load is far more expensive than a simple integer addition.

---

## Motivation

Compilers need to know which parts of a program are expensive. Profilers do this at runtime, but **static analysis** can catch hotspots before execution. This pass:

- Gives you a **function-level cost score** without running the program.
- Lets you tweak weights to match your target hardware (e.g., embedded systems where memory ops are 10× costlier).
- Exports machine-readable **CSV output** for further analysis or visualization.

---

## Features

| Feature | Details |
|---|---|
| Instruction classification | 7 categories with correct LLVM opcode mapping |
| Configurable weights | External `weights.cfg` file, hot-reloadable |
| Hotspot detection | Flags functions whose cost ≥ configurable threshold |
| Loop analysis | Total loops, nesting depth, severity classification (None/Light/Moderate/Heavy) |
| Basic-block breakdown | Per-BB cost shown in terminal and CSV |
| CSV export | `function,basic_block,group,count,weight,cost,pct` |
| Comparison mode | O0 vs O2 cost and instruction reduction analysis |
| Optimization delta | Function-level cost and instruction deltas for visualization |
| JSON export | Structured summary with all metrics and loop severity |
| Text summary | Human-readable function-level analysis |
| Legacy pass manager | Compatible with `opt-14 -enable-new-pm=0` |
| CLI options | `--weight-file`, `--hot-threshold`, `--out-file`, comparison/summary options |

---

## Project Structure

```
weighted-inst-freq/
├── WeightedInstFreq.cpp      # LLVM pass implementation
├── CMakeLists.txt            # Build system
├── weights.cfg               # Instruction category weights
├── test.c                    # Sample C program for testing
├── README.md                 # This file
├── .gitignore
└── optional_visualizer/
    ├── visualize.py          # Python bar-chart generator
    └── README.md
```

---

## Prerequisites

### System Requirements
- Ubuntu 20.04 / 22.04 (or compatible Debian-based Linux)
- LLVM 14, Clang 14
- CMake ≥ 3.13
- GCC / build-essential

### Install Dependencies

```bash
sudo apt update
sudo apt install -y llvm-14 llvm-14-dev clang-14 cmake build-essential
```

Verify installation:

```bash
llvm-config-14 --version   # should print 14.x.x
clang-14 --version
opt-14 --version
```

---

## Build

```bash
# From the project root directory
mkdir -p build
cd build
cmake -DLLVM_DIR=/usr/lib/llvm-14/lib/cmake/llvm ..
make
```

On success you will see `libWeightedInstFreq.so` inside the `build/` directory.

**Troubleshooting build:**
- If `LLVM_DIR` is wrong, find it with: `llvm-config-14 --cmakedir`
- If you get RTTI errors, ensure LLVM was built without RTTI (the CMakeLists handles this automatically).

---

## Generate LLVM IR

Compile `test.c` to LLVM IR using Clang. Use `-O0` to disable optimizations so every instruction is visible in the output:

```bash
# Run from the project root (not inside build/)
clang-14 -O0 -S -emit-llvm test.c -o test.ll
```

Inspect the IR (optional):

```bash
cat test.ll
```

---

## Run the Pass

```bash
opt-14 -enable-new-pm=0 \
    -load ./build/libWeightedInstFreq.so \
    -weighted-inst-freq \
    -weight-file=./weights.cfg \
    -hot-threshold=30 \
    -out-file=results.csv \
    -summary-file=summary.txt \
    -json-file=summary.json \
    -compare-mode=true \
    -compare-csv=optimization_comparison.csv \
    test.ll
```

### Option Reference

| Option | Default | Description |
|---|---|---|
| `-enable-new-pm=0` | — | **Required** — forces the legacy pass manager |
| `-load <path>` | — | Path to `libWeightedInstFreq.so` |
| `-weighted-inst-freq` | — | Activates this pass by name |
| `-weight-file=<path>` | `weights.cfg` | Path to category weight config file |
| `-hot-threshold=<N>` | `30` | Functions with cost ≥ N are flagged as hotspots |
| `-out-file=<path>` | `results.csv` | Path for CSV output |
| `-summary-file=<path>` | `summary.txt` | Path for text summary output |
| `-json-file=<path>` | `summary.json` | Path for JSON summary output |
| `-compare-mode=<true|false>` | `false` | Enable O0 vs O2 comparison mode |
| `-compare-csv=<path>` | `optimization_comparison.csv` | Output file for comparison results |
| `-baseline-csv=<path>` | — | Optional O0 baseline CSV input for comparison |
| `-disable-output` | — | Suppresses IR output (analysis only) |

---

## Expected Terminal Output (Sample)

```
[WeightedInstFreq] Loading weights from: ./weights.cfg
[WeightedInstFreq]   Arithmetic = 1
[WeightedInstFreq]   Memory = 3
[WeightedInstFreq]   ControlFlow = 1
[WeightedInstFreq]   Call = 5
[WeightedInstFreq]   Cast = 1
[WeightedInstFreq]   Comparison = 1
[WeightedInstFreq]   Other = 1

========================================
  Weighted Instruction Frequency Pass
========================================
  Weight file  : ./weights.cfg
  Hot threshold: 30
  Output CSV   : results.csv
========================================

┌─────────────────────────────────────────────────────────┐
│ Function: sum_array                                      │
├──────────────┬────────┬────────┬──────────┬────────────┤
│ Category     │ Count  │ Weight │   Cost   │    Pct     │
├──────────────┼────────┼────────┼──────────┼────────────┤
│ Arithmetic   │      3 │    1.0 │     3.00 │   6.67%    │
│ Memory       │      9 │    3.0 │    27.00 │  60.00%    │
│ ControlFlow  │      3 │    1.0 │     3.00 │   6.67%    │
│ Call         │      0 │    5.0 │     0.00 │   0.00%    │
│ Cast         │      0 │    1.0 │     0.00 │   0.00%    │
│ Comparison   │      2 │    1.0 │     2.00 │   4.44%    │
│ Other        │     10 │    1.0 │    10.00 │  22.22%    │
├──────────────┼────────┼────────┼──────────┼────────────┤
│ TOTAL        │     27 │        │    45.00 │ 100.00%    │
└──────────────┴────────┴────────┴──────────┴────────────┘

  Basic Block Cost Breakdown:
  -------------------------------------------------------
  entry                 insts:    8   cost:    17.00
  for.cond              insts:    4   cost:     6.00
  for.body              insts:    7   cost:    16.00
  for.inc               insts:    3   cost:     4.00
  for.end               insts:    5   cost:     6.00
  -------------------------------------------------------

  *** HOTSPOT DETECTED *** Function 'sum_array' has weighted cost 45.00 >= threshold 30
```

---

## Expected CSV Output (Sample)

```csv
function,basic_block,group,count,weight,cost,pct
sum_array,FUNCTION_TOTAL,Arithmetic,3,1.00,3.00,6.67
sum_array,FUNCTION_TOTAL,Memory,9,3.00,27.00,60.00
sum_array,FUNCTION_TOTAL,ControlFlow,3,1.00,3.00,6.67
sum_array,FUNCTION_TOTAL,Call,0,5.00,0.00,0.00
sum_array,FUNCTION_TOTAL,Cast,0,1.00,0.00,0.00
sum_array,FUNCTION_TOTAL,Comparison,2,1.00,2.00,4.44
sum_array,FUNCTION_TOTAL,Other,10,1.00,10.00,22.22
sum_array,entry,Arithmetic,0,1.00,0.00,0.00
...
```

View it:

```bash
cat results.csv
```

---

## Comparison and Optimization Delta Outputs (Compare Mode)

When `-compare-mode=true` is enabled and a baseline O0 CSV is provided via `-baseline-csv`, the pass generates two additional CSV files:

**optimization_comparison.csv** — Direct function-level comparison:

```csv
function,O0_cost,O2_cost,reduction_pct,O0_insts,O2_insts,loop_severity
sum_array,66.00,45.00,31.82,27,23,Light
factorial,40.00,28.00,30.00,18,16,None
compute,136.00,91.00,33.08,104,71,Moderate
```

**optimization_delta.csv** — Detailed deltas for visualization:

```csv
function,O0_cost,O2_cost,cost_delta,reduction_pct,O0_insts,O2_insts,inst_delta,loop_severity
sum_array,66.00,45.00,21.00,31.82,27,23,-4,Light
factorial,40.00,28.00,12.00,30.00,18,16,-2,None
compute,136.00,91.00,45.00,33.08,104,71,-33,Moderate
```

Loop severity is classified as:
- **None**: No loops
- **Light**: Loops present but max nesting depth ≤ 1
- **Moderate**: Multiple loops (>5) or depth ≤ 1
- **Heavy**: Nested loops (max depth ≥ 2) or loops with many blocks

---

## How to Change Weights

Open `weights.cfg` and adjust the values:

```
# Make memory ops twice as expensive (e.g., for embedded systems)
Memory=6

# Make calls even more expensive
Call=10
```

Then re-run the pass — no recompilation needed:

```bash
opt-14 -enable-new-pm=0 \
    -load ./build/libWeightedInstFreq.so \
    -weighted-inst-freq \
    -weight-file=./weights.cfg \
    -hot-threshold=50 \
    -out-file=results.csv \
    -disable-output \
    test.ll
```

---

## JSON Summary Output

The `-json-file=summary.json` option writes a structured JSON with all analysis results:

```json
{
  "module_summary": {
    "total_functions": 6,
    "total_cost": 287.00,
    "highest_cost_function": "main",
    "highest_cost": 287.00,
    "total_loops": 3,
    "max_loop_depth": 2,
    "loop_blocks": 8
  },
  "functions": [
    {
      "function": "sum_array",
      "total_insts": 23,
      "total_cost": 45.00,
      "dominant_category": "Memory",
      "loop_count": 1,
      "max_loop_depth": 1,
      "loop_blocks": 3,
      "loop_severity": "Light",
      "is_hotspot": true,
      "suggestions": [
        "High memory dominance; review data locality and memory access patterns."
      ]
    }
  ]
}
```

---

## How Hotspot Detection Works

Every function's total weighted cost is computed as:

```
total_cost = Σ (count_per_category × weight_per_category)
```

If `total_cost >= hot-threshold`, the pass prints:

```
*** HOTSPOT DETECTED *** Function 'X' has weighted cost Y >= threshold Z
```

**Tuning the threshold:**
- Lower it (e.g., `10`) to flag more functions.
- Higher it (e.g., `100`) to flag only very expensive functions.
- Set it to `0` to flag every function.

---

## Troubleshooting

| Problem | Solution |
|---|---|
| `opt-14: command not found` | `sudo apt install llvm-14` |
| `clang-14: command not found` | `sudo apt install clang-14` |
| `CMake can't find LLVM` | Run `llvm-config-14 --cmakedir` to get the correct path |
| `error: fno-rtti` conflict | LLVM must be built without RTTI. LLVM 14 from apt is. |
| `Cannot open weight file` | Check path. Pass `--weight-file=./weights.cfg` from build dir |
| Empty CSV | Ensure `-disable-output` is after the pass flags, not before |
| No hotspot warnings | Lower `--hot-threshold` or check your IR has non-trivial functions |

---

## Clean

```bash
rm -rf build/
rm -f test.ll results.csv
```

---

## Optional Visualization

If you have Python 3 with pandas and matplotlib:

```bash
cd optional_visualizer
pip install pandas matplotlib
python3 visualize.py ../results.csv
```

This generates `cost_plot.png` — a bar chart of weighted cost by function and category.

See `optional_visualizer/README.md` for details.

---

## Demo Checklist

- [ ] Install: `sudo apt install llvm-14 llvm-14-dev clang-14 cmake build-essential`
- [ ] Build: `mkdir build && cd build && cmake -DLLVM_DIR=/usr/lib/llvm-14/lib/cmake/llvm .. && make`
- [ ] IR: `clang-14 -O0 -S -emit-llvm test.c -o test.ll`
- [ ] Run: `opt-14 -enable-new-pm=0 -load ./build/libWeightedInstFreq.so -weighted-inst-freq -weight-file=./weights.cfg -hot-threshold=30 -out-file=results.csv -disable-output test.ll`
- [ ] Inspect: `cat results.csv`
- [ ] Optional: `cd optional_visualizer && python3 visualize.py ../results.csv`

---

*This project is the core deliverable. The optional visualizer is supplementary.*