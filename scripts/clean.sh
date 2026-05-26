#!/bin/bash
# scripts/clean.sh
# Cleans build and run artifacts while keeping source code and documentation safe.
# Works from repository root or scripts directory.

# Get the directory of the script and resolve the repo root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_ROOT"

echo "=== Cleaning Build and Run Artifacts ==="

# Remove build directory
if [ -d "build" ]; then
    echo "Removing build/..."
    rm -rf build
fi

# Remove results outputs but preserve results folder structure
if [ -d "results" ]; then
    echo "Cleaning results/ directories..."
    rm -f results/O0/*
    rm -f results/O2/*
    rm -f results/comparison/*
    rm -f results/logs/*
fi

# Remove stray .ll, .bc, or temporary files from root or testcases
echo "Removing temporary LLVM IR files..."
rm -f testcases/*.ll
rm -f testcases/*.bc
rm -f *.ll
rm -f *.bc
rm -f *.csv
rm -f *.json
rm -f summary.txt

echo "=== Clean Completed! Source and documentation are untouched. ==="
