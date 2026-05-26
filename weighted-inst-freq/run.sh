#!/bin/bash
set -e

# Make sure we are in the script's directory
cd "$(dirname "$0")"

echo "=== 1. Building LLVM Pass shared library ==="
mkdir -p build
cd build
cmake -DLLVM_DIR=/usr/lib/llvm-14/lib/cmake/llvm ..
make
cd ..

echo "=== 2. Compiling test.c to LLVM IR (O0 & O2) ==="
clang-14 -O0 -S -emit-llvm test.c -o test.ll
clang-14 -O2 -S -emit-llvm test.c -o test_O2.ll

echo "=== 3. Running Analysis Pass on O0 (Baseline) ==="
opt-14 -enable-new-pm=0 \
    -load ./build/libWeightedInstFreq.so \
    -weighted-inst-freq \
    -wif-weight-file=./weights.cfg \
    -wif-hot-threshold=30 \
    -wif-out-file=results.csv \
    -wif-summary-file=summary.txt \
    -wif-json-file=summary.json \
    -disable-output \
    test.ll

echo "=== 4. Running Analysis Pass on O2 (Comparison) ==="
opt-14 -enable-new-pm=0 \
    -load ./build/libWeightedInstFreq.so \
    -weighted-inst-freq \
    -wif-weight-file=./weights.cfg \
    -wif-hot-threshold=30 \
    -wif-out-file=results_O2.csv \
    -wif-compare-mode=true \
    -wif-compare-csv=optimization_comparison.csv \
    -wif-baseline-csv=results.csv \
    -disable-output \
    test_O2.ll

echo "=== 5. Copying results to visualizer public folder ==="
FRONTEND_PUBLIC="weighted-inst-freq-frontend/weighted-inst-freq/frontend/public"
mkdir -p "$FRONTEND_PUBLIC"
cp results.csv "$FRONTEND_PUBLIC/results.csv"
cp summary.json "$FRONTEND_PUBLIC/summary.json"
cp optimization_comparison_delta.csv "$FRONTEND_PUBLIC/optimization_comparison_delta.csv"
cp test.ll "$FRONTEND_PUBLIC/test.ll"
cp test_O2.ll "$FRONTEND_PUBLIC/test_O2.ll"
cp weights.cfg "$FRONTEND_PUBLIC/weights.cfg"

echo "=== Done! Files generated and copied successfully. ==="
