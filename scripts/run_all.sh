#!/bin/bash
# scripts/run_all.sh
# Runs O0 and O2 analysis on all valid testcases, runs the failure testcase separately,
# and generates the final evaluation and comparison reports.
# Works from repository root or scripts directory.

set -e

# Get the directory of the script and resolve the repo root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_ROOT"

echo "=== Starting Full WeightedInstFreq Evaluation Pipeline ==="

# Ensure directories exist
mkdir -p results/O0 results/O2 results/comparison results/logs

# Valid testcases to execute
VALID_TESTCASES=(
    "test"
    "test_basic"
    "test_loops"
    "test_recursion"
    "test_memory"
    "test_matrix"
)

# 1. Run all valid testcases at O0 and O2
for tc in "${VALID_TESTCASES[@]}"; do
    echo "--------------------------------------------------"
    ./scripts/run.sh "$tc"
done

# 2. Run invalid testcase separately and capture failure log
echo "--------------------------------------------------"
echo "=== Running Failure Testcase: test_invalid ==="
CLANG_CMD="clang-14"
if ! command -v clang-14 &> /dev/null; then
    CLANG_CMD="clang"
fi

echo "  Compiling testcases/test_invalid.c (Expect compiler error)..."
if $CLANG_CMD -O0 -S -emit-llvm testcases/test_invalid.c -o results/logs/test_invalid.ll &> results/logs/failure_case_log.txt; then
    echo "  [WARNING] test_invalid.c compiled successfully! Expected compilation failure."
else
    echo "  [SUCCESS] test_invalid.c compilation failed. Logs saved to results/logs/failure_case_log.txt"
fi

# 3. Generate aggregated reports using Python report script
echo "--------------------------------------------------"
echo "=== Generating Comparison and Summary Reports ==="
if command -v python3 &> /dev/null; then
    python3 ./scripts/generate_reports.py
elif command -v python &> /dev/null; then
    python ./scripts/generate_reports.py
else
    echo "  [ERROR] Python is not installed. Cannot generate consolidated reports."
    exit 1
fi

echo "--------------------------------------------------"
echo "=== Evaluation Pipeline Finished Successfully! ==="
echo "All outputs available in results/ directory."
