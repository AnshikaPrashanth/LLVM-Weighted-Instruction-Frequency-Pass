#!/bin/bash
# scripts/run.sh
# Run the LLVM pass on a single testcase.
# Usage: ./scripts/run.sh test_basic

set -e

# Get the directory of the script and resolve the repo root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_ROOT"

# Ensure output directories exist
mkdir -p results/O0 results/O2 results/comparison results/logs

# Find Clang and Opt command names
CLANG_CMD="clang-14"
OPT_CMD="opt-14"

if ! command -v clang-14 &> /dev/null; then
    CLANG_CMD="clang"
fi
if ! command -v opt-14 &> /dev/null; then
    OPT_CMD="opt"
fi

if [ -z "$1" ]; then
    echo "Usage: $0 <testcase_name_or_file>"
    echo "Example: $0 test_basic"
    exit 1
fi

# Clean up input name
INPUT_PATH="$1"
BASE=$(basename "$INPUT_PATH" .c)

echo "=== Processing Testcase: $BASE ==="

# 1. Compile C file to LLVM IR (O0 & O2)
echo "  [1/4] Compiling to LLVM IR..."
$CLANG_CMD -O0 -S -emit-llvm "testcases/$BASE.c" -o "results/O0/$BASE.ll" 2> "results/logs/${BASE}_clang_O0.log"
$CLANG_CMD -O2 -S -emit-llvm "testcases/$BASE.c" -o "results/O2/$BASE.ll" 2> "results/logs/${BASE}_clang_O2.log"

# 2. Run LLVM Pass on O0 (Baseline)
echo "  [2/4] Running WeightedInstFreq Pass on O0 IR..."
$OPT_CMD -enable-new-pm=0 \
    -load ./build/libWeightedInstFreq.so \
    -weighted-inst-freq \
    -wif-weight-file=./weights.cfg \
    -wif-hot-threshold=30 \
    -wif-out-file="results/O0/${BASE}_results.csv" \
    -wif-summary-file="results/O0/${BASE}_summary.txt" \
    -wif-json-file="results/O0/${BASE}_summary.json" \
    -disable-output \
    "results/O0/$BASE.ll" 2> "results/logs/${BASE}_opt_O0.log"

# 3. Run LLVM Pass on O2 (Optimized with comparison)
echo "  [3/4] Running WeightedInstFreq Pass on O2 IR with comparison..."
$OPT_CMD -enable-new-pm=0 \
    -load ./build/libWeightedInstFreq.so \
    -weighted-inst-freq \
    -wif-weight-file=./weights.cfg \
    -wif-hot-threshold=30 \
    -wif-out-file="results/O2/${BASE}_results.csv" \
    -wif-summary-file="results/O2/${BASE}_summary.txt" \
    -wif-json-file="results/O2/${BASE}_summary.json" \
    -wif-compare-mode=true \
    -wif-compare-csv="results/comparison/${BASE}_optimization_comparison.csv" \
    -wif-baseline-csv="results/O0/${BASE}_results.csv" \
    -disable-output \
    "results/O2/$BASE.ll" 2> "results/logs/${BASE}_opt_O2.log"

# 4. Copy results to dashboard public folder (if dashboard exists)
DASHBOARD_PUBLIC="dashboard/public"
if [ -d "$DASHBOARD_PUBLIC" ]; then
    echo "  [4/4] Copying results to dashboard/public..."
    mkdir -p "$DASHBOARD_PUBLIC"
    cp "results/O0/${BASE}_results.csv" "$DASHBOARD_PUBLIC/${BASE}_results.csv"
    cp "results/O0/${BASE}_summary.json" "$DASHBOARD_PUBLIC/${BASE}_summary.json"
    if [ -f "results/comparison/${BASE}_optimization_comparison_delta.csv" ]; then
        cp "results/comparison/${BASE}_optimization_comparison_delta.csv" "$DASHBOARD_PUBLIC/${BASE}_optimization_comparison_delta.csv"
    fi
    
    # Also copy as default un-prefixed names for dashboard auto-loading (for 'test' benchmark)
    if [ "$BASE" = "test" ]; then
        cp "results/O0/test_results.csv" "$DASHBOARD_PUBLIC/results.csv"
        cp "results/O0/test_summary.json" "$DASHBOARD_PUBLIC/summary.json"
        if [ -f "results/comparison/test_optimization_comparison_delta.csv" ]; then
            cp "results/comparison/test_optimization_comparison_delta.csv" "$DASHBOARD_PUBLIC/optimization_comparison_delta.csv"
        fi
    fi
fi

echo "  Done. Outputs generated in results/ directory!"
