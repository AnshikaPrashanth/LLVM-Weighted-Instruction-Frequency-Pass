#!/bin/bash
# scripts/build.sh
# Build script for WeightedInstFreq LLVM Pass.
# Works from repository root or scripts directory.

set -e

# Get the directory of the script and resolve the repo root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_ROOT"

echo "=== Building WeightedInstFreq LLVM Pass ==="

# Try to find LLVM 14 cmake config path
if command -v llvm-config-14 &> /dev/null; then
    LLVM_DIR_DETECTED="$(llvm-config-14 --cmakedir)"
elif command -v llvm-config &> /dev/null; then
    LLVM_DIR_DETECTED="$(llvm-config --cmakedir)"
else
    LLVM_DIR_DETECTED="/usr/lib/llvm-14/lib/cmake/llvm"
fi

echo "Detected LLVM CMake Dir: $LLVM_DIR_DETECTED"

# Create build directory
mkdir -p build
cd build

# Run CMake and Make
cmake -DLLVM_DIR="$LLVM_DIR_DETECTED" ..
make -j$(nproc 2>/dev/null || echo 2)

echo "=== Build Completed Successfully! ==="
echo "Artifact: build/libWeightedInstFreq.so"
