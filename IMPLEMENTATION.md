# Implementation Deep Dive: Weighted Instruction Frequency

This document describes the concrete implementation details of the **Weighted Instruction Frequency Pass** code in [WeightedInstFreq.cpp](file:///e:/ELS/cd%20lab%20el/src/WeightedInstFreq.cpp).

---

## 1. Class Structure & LLVM Legacy PM Integration

The pass is implemented as a subclass of `llvm::FunctionPass`, registering itself in the LLVM legacy pass manager:

```cpp
struct WeightedInstFreqPass : public FunctionPass {
    static char ID; // Unique pass identification, replacement for RTTI
    
    std::map<InstGroup, double> weights;
    std::vector<FuncResult> allResults;
    ...
    
    WeightedInstFreqPass() : FunctionPass(ID) {}
    bool doInitialization(Module &M) override;
    bool runOnFunction(Function &F) override;
    bool doFinalization(Module &M) override;
    void getAnalysisUsage(AnalysisUsage &AU) const override;
};
```

### 1.1 Lifetime Hooks
- **`doInitialization`**: Executed once before processing any function. Loads weights from `weights.cfg`, opens file streams, and parses baseline CSV metrics if `-wif-compare-mode` is set.
- **`runOnFunction`**: Main entrypoint executed for every function in the input module.
- **`doFinalization`**: Executed once after all functions have been evaluated. Formats and writes the global module report into `summary.txt` and `summary.json`, and writes comparison results.
- **`getAnalysisUsage`**: Informs LLVM that this pass is read-only (preserves all analyses) and requires the LLVM LoopInfo manager:
  ```cpp
  AU.addRequired<LoopInfoWrapperPass>();
  ```

---

## 2. Dynamic Weights Configuration Parser

The parser reads the `weights.cfg` file line-by-line using C++ stream utilities (`std::ifstream`), handling comments and whitespaces.

### 2.1 Trimming Utility
To isolate option keys and values, the `trim` function removes spacing, tabs, and carriage returns:
```cpp
static std::string trim(const std::string &s) {
    size_t start = s.find_first_not_of(" \t\r\n");
    size_t end   = s.find_last_not_of(" \t\r\n");
    if (start == std::string::npos) return "";
    return s.substr(start, end - start + 1);
}
```

### 2.2 Key Matching
The values are read as strings, validated as positive floats using `std::stod`, and registered:
```cpp
static bool parseGroupName(const std::string &key, InstGroup &out) {
    if (key == "Arithmetic")  { out = InstGroup::Arithmetic;  return true; }
    if (key == "Memory")      { out = InstGroup::Memory;      return true; }
    ...
}
```

---

## 3. Loop Info Integration Logic

Inside `runOnFunction`, the pass obtains the loop hierarchy via LLVM's `LoopInfoWrapperPass`:

```cpp
LoopInfo &LI = getAnalysis<LoopInfoWrapperPass>().getLoopInfo();
```

To extract maximum nesting and loops count, the pass recursively crawls child loops:

```cpp
static void collectLoopMetrics(Loop *L, unsigned depth,
                               unsigned &totalLoops,
                               unsigned &maxDepth,
                               std::set<const BasicBlock*> &loopBlocks) {
    totalLoops += 1;
    maxDepth = std::max(maxDepth, depth);
    for (BasicBlock *BB : L->blocks())
        loopBlocks.insert(BB);
    for (Loop *Sub : L->getSubLoops())
        collectLoopMetrics(Sub, depth + 1, totalLoops, maxDepth, loopBlocks);
}
```

---

## 4. Analysis Code Flow

For each function, `runOnFunction` executes the following sequence:

```mermaid
sequenceDiagram
    participant opt as LLVM opt-14
    participant Pass as WeightedInstFreqPass
    participant LI as LoopInfoWrapperPass

    opt->>Pass: runOnFunction(F)
    Pass->>LI: getAnalysis<LoopInfoWrapperPass>()
    LI-->>Pass: Return LoopInfo Reference
    
    Note over Pass: Loop over BasicBlocks & Instructions
    Note over Pass: Classify Instruction & Increment Category Counts
    
    Pass->>Pass: collectLoopMetrics() (Recursive Loop Crawling)
    Pass->>Pass: Compute Weighted Cost & Hotspot Flag
    Pass->>Pass: Format & Print Text Box to Terminal
    Pass->>Pass: Write function blocks to CSV
    Pass-->>opt: Return false (CFG preserved)
```

---

## 5. Output Schemas

### 5.1 CSV File Layout (`results/O0/<testcase>_results.csv`)
Logs details at both function-level (`FUNCTION_TOTAL`) and individual basic block levels:
```csv
function,basic_block,group,count,weight,cost,pct
sum_array,FUNCTION_TOTAL,Memory,9,3.00,27.00,60.00
sum_array,entry,Arithmetic,0,1.00,0.00,0.00
...
```

### 5.2 JSON File Layout (`results/O0/<testcase>_summary.json`)
Allows programmatic access to functions and loops metadata:
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
> [!NOTE]
> JSON export is fully implemented inside `doFinalization` in `WeightedInstFreq.cpp`.
