//===----------------------------------------------------------------------===//
// WeightedInstFreq.cpp
//
// LLVM Legacy Analysis Pass: Weighted Instruction Frequency
//
// This pass traverses every function and basic block in LLVM IR,
// classifies instructions into categories (Arithmetic, Memory, ControlFlow,
// Call, Cast, Comparison, Other), applies configurable per-category weights,
// computes weighted costs, detects hotspot functions, and exports CSV output.
//
// Usage:
//   opt-14 -enable-new-pm=0 -load ./libWeightedInstFreq.so
//          -weighted-inst-freq -weight-file=../weights.cfg
//          -hot-threshold=30 -out-file=results.csv
//          -disable-output test.ll
//===----------------------------------------------------------------------===//

#include "llvm/Pass.h"
#include "llvm/IR/Function.h"
#include "llvm/IR/BasicBlock.h"
#include "llvm/IR/Instruction.h"
#include "llvm/IR/Instructions.h"
#include "llvm/IR/Module.h"
#include "llvm/Support/raw_ostream.h"
#include "llvm/Support/CommandLine.h"
#include "llvm/IR/LegacyPassManager.h"
#include "llvm/Transforms/IPO/PassManagerBuilder.h"
#include "llvm/Analysis/LoopInfo.h"

#include <fstream>
#include <sstream>
#include <string>
#include <map>
#include <set>
#include <vector>
#include <algorithm>
#include <iomanip>

using namespace llvm;

//===----------------------------------------------------------------------===//
// Command-line options
//===----------------------------------------------------------------------===//

static cl::opt<std::string> WeightFile(
    "wif-weight-file",
    cl::desc("Path to weights config file (key=value format)"),
    cl::value_desc("filename"),
    cl::init("weights.cfg")
);

static cl::opt<double> HotThreshold(
    "wif-hot-threshold",
    cl::desc("Weighted cost threshold to flag a function as a hotspot"),
    cl::value_desc("number"),
    cl::init(30.0)
);

static cl::opt<std::string> OutFile(
    "wif-out-file",
    cl::desc("Path to output CSV file"),
    cl::value_desc("filename"),
    cl::init("results.csv")
);

static cl::opt<bool> CompareMode(
    "wif-compare-mode",
    cl::desc("Enable O0 vs O2 comparison mode"),
    cl::init(false)
);

static cl::opt<std::string> CompareCsv(
    "wif-compare-csv",
    cl::desc("Path to optimization comparison CSV output"),
    cl::value_desc("filename"),
    cl::init("optimization_comparison.csv")
);

static cl::opt<std::string> BaselineCsv(
    "wif-baseline-csv",
    cl::desc("Optional O0 baseline CSV file for comparison"),
    cl::value_desc("filename"),
    cl::init("")
);

static cl::opt<std::string> SummaryFile(
    "wif-summary-file",
    cl::desc("Path to text summary file"),
    cl::value_desc("filename"),
    cl::init("summary.txt")
);

static cl::opt<std::string> JsonFile(
    "wif-json-file",
    cl::desc("Path to JSON output file"),
    cl::value_desc("filename"),
    cl::init("summary.json")
);

//===----------------------------------------------------------------------===//
// Instruction categories
//===----------------------------------------------------------------------===//

enum class InstGroup {
    Arithmetic,
    Memory,
    ControlFlow,
    Call,
    Cast,
    Comparison,
    Other
};

// Convert enum to string label
static std::string groupName(InstGroup g) {
    switch (g) {
        case InstGroup::Arithmetic:  return "Arithmetic";
        case InstGroup::Memory:      return "Memory";
        case InstGroup::ControlFlow: return "ControlFlow";
        case InstGroup::Call:        return "Call";
        case InstGroup::Cast:        return "Cast";
        case InstGroup::Comparison:  return "Comparison";
        default:                     return "Other";
    }
}

// All groups in order (for deterministic iteration)
static const std::vector<InstGroup> AllGroups = {
    InstGroup::Arithmetic,
    InstGroup::Memory,
    InstGroup::ControlFlow,
    InstGroup::Call,
    InstGroup::Cast,
    InstGroup::Comparison,
    InstGroup::Other
};

//===----------------------------------------------------------------------===//
// Classify an instruction into a group
//===----------------------------------------------------------------------===//

static InstGroup opcodeToGroup(unsigned op) {
    // Arithmetic
    switch (op) {
        case Instruction::Add:
        case Instruction::FAdd:
        case Instruction::Sub:
        case Instruction::FSub:
        case Instruction::Mul:
        case Instruction::FMul:
        case Instruction::UDiv:
        case Instruction::SDiv:
        case Instruction::FDiv:
        case Instruction::URem:
        case Instruction::SRem:
        case Instruction::FRem:
            return InstGroup::Arithmetic;
        default: break;
    }

    // Memory
    switch (op) {
        case Instruction::Alloca:
        case Instruction::Load:
        case Instruction::Store:
        case Instruction::GetElementPtr:
            return InstGroup::Memory;
        default: break;
    }

    // Control flow
    switch (op) {
        case Instruction::Br:
        case Instruction::Switch:
        case Instruction::IndirectBr:
        case Instruction::Ret:
        case Instruction::Resume:
        case Instruction::Unreachable:
            return InstGroup::ControlFlow;
        default: break;
    }

    // Call-like instructions
    switch (op) {
        case Instruction::Call:
        case Instruction::Invoke:
        case Instruction::CallBr:
            return InstGroup::Call;
        default: break;
    }

    // Cast instructions
    switch (op) {
        case Instruction::Trunc:
        case Instruction::ZExt:
        case Instruction::SExt:
        case Instruction::FPToUI:
        case Instruction::FPToSI:
        case Instruction::UIToFP:
        case Instruction::SIToFP:
        case Instruction::FPTrunc:
        case Instruction::FPExt:
        case Instruction::PtrToInt:
        case Instruction::IntToPtr:
        case Instruction::BitCast:
        case Instruction::AddrSpaceCast:
            return InstGroup::Cast;
        default: break;
    }

    // Comparison
    switch (op) {
        case Instruction::ICmp:
        case Instruction::FCmp:
            return InstGroup::Comparison;
        default: break;
    }

    return InstGroup::Other;
}

static InstGroup classifyInstruction(const Instruction &I) {
    return opcodeToGroup(I.getOpcode());
}

//===----------------------------------------------------------------------===//
// Config file parser
//===----------------------------------------------------------------------===//

// Default weights
static std::map<InstGroup, double> defaultWeights() {
    return {
        {InstGroup::Arithmetic,  1.0},
        {InstGroup::Memory,      3.0},
        {InstGroup::ControlFlow, 1.0},
        {InstGroup::Call,        5.0},
        {InstGroup::Cast,        1.0},
        {InstGroup::Comparison,  1.0},
        {InstGroup::Other,       1.0}
    };
}

// Trim whitespace from both ends
static std::string trim(const std::string &s) {
    size_t start = s.find_first_not_of(" \t\r\n");
    size_t end   = s.find_last_not_of(" \t\r\n");
    if (start == std::string::npos) return "";
    return s.substr(start, end - start + 1);
}

// Map group name string to enum
static bool parseGroupName(const std::string &key, InstGroup &out) {
    if (key == "Arithmetic")  { out = InstGroup::Arithmetic;  return true; }
    if (key == "Memory")      { out = InstGroup::Memory;      return true; }
    if (key == "ControlFlow") { out = InstGroup::ControlFlow; return true; }
    if (key == "Call")        { out = InstGroup::Call;        return true; }
    if (key == "Cast")        { out = InstGroup::Cast;        return true; }
    if (key == "Comparison")  { out = InstGroup::Comparison;  return true; }
    if (key == "Other")       { out = InstGroup::Other;       return true; }
    return false;
}

static std::string escapeJsonString(const std::string &s) {
    std::string out;
    out.reserve(s.size());
    for (char c : s) {
        switch (c) {
            case '\\': out += "\\\\"; break;
            case '"': out += "\\\""; break;
            case '\n': out += "\\n"; break;
            case '\r': out += "\\r"; break;
            case '\t': out += "\\t"; break;
            default: out += c; break;
        }
    }
    return out;
}

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

static std::string classifyLoopSeverity(unsigned loopCount, unsigned maxDepth) {
    if (loopCount == 0) return "None";
    if (maxDepth >= 2) return "Heavy";
    if (loopCount > 5) return "Moderate";
    return "Light";
}

static std::map<std::string, std::pair<double, unsigned>> parseBaselineCsv(const std::string &path) {
    std::map<std::string, std::pair<double, unsigned>> baseline;
    std::ifstream in(path);
    if (!in.is_open()) return baseline;

    std::string line;
    std::getline(in, line); // header
    while (std::getline(in, line)) {
        std::istringstream ss(line);
        std::string function, bb, group, countStr, weightStr, costStr, pctStr;
        if (!std::getline(ss, function, ',')) continue;
        if (!std::getline(ss, bb, ',')) continue;
        if (!std::getline(ss, group, ',')) continue;
        if (!std::getline(ss, countStr, ',')) continue;
        if (!std::getline(ss, weightStr, ',')) continue;
        if (!std::getline(ss, costStr, ',')) continue;
        if (!std::getline(ss, pctStr, ',')) continue;

        if (bb != "FUNCTION_TOTAL") continue;
        try {
            unsigned count = std::stoul(countStr);
            double cost = std::stod(costStr);
            auto &entry = baseline[function];
            entry.first += cost;
            entry.second += count;
        } catch (...) {
            continue;
        }
    }
    return baseline;
}

// Parse weights.cfg and return a weight map
static std::map<InstGroup, double> loadWeights(const std::string &path) {
    std::map<InstGroup, double> weights = defaultWeights();

    std::ifstream file(path);
    if (!file.is_open()) {
        errs() << "[WeightedInstFreq] WARNING: Cannot open weight file '"
               << path << "'. Using default weights.\n";
        return weights;
    }

    errs() << "[WeightedInstFreq] Loading weights from: " << path << "\n";

    std::string line;
    int lineNum = 0;
    while (std::getline(file, line)) {
        ++lineNum;
        line = trim(line);

        // Skip empty lines and comments
        if (line.empty() || line[0] == '#') continue;

        // Expect key=value
        size_t eq = line.find('=');
        if (eq == std::string::npos) {
            errs() << "[WeightedInstFreq] WARNING: Malformed line " << lineNum
                   << " in config (no '='): " << line << "\n";
            continue;
        }

        std::string key   = trim(line.substr(0, eq));
        std::string value = trim(line.substr(eq + 1));

        InstGroup g;
        if (!parseGroupName(key, g)) {
            errs() << "[WeightedInstFreq] WARNING: Unknown category '"
                   << key << "' on line " << lineNum << ". Skipping.\n";
            continue;
        }

        try {
            double w = std::stod(value);
            if (w < 0) {
                errs() << "[WeightedInstFreq] WARNING: Negative weight for '"
                       << key << "'. Using default.\n";
            } else {
                weights[g] = w;
                errs() << "[WeightedInstFreq]   " << key << " = " << w << "\n";
            }
        } catch (...) {
            errs() << "[WeightedInstFreq] WARNING: Invalid value '" << value
                   << "' for key '" << key << "' on line " << lineNum << ".\n";
        }
    }

    file.close();
    return weights;
}

//===----------------------------------------------------------------------===//
// Data structures for analysis results
//===----------------------------------------------------------------------===//

// Per-category counts for a basic block or function
using GroupCount = std::map<InstGroup, unsigned>;
using GroupCostMap = std::map<InstGroup, double>;

struct BBResult {
    std::string name;           // basic block label
    GroupCount  counts;         // instruction count per category
    unsigned    totalCount = 0;
};

struct FuncResult {
    std::string          funcName;
    std::vector<BBResult> blocks;
    GroupCount            totalCounts; // sum across all BBs
    unsigned              totalInsts = 0;
    double                totalCost  = 0.0;
    bool                  isHotspot  = false;
    unsigned              loopCount  = 0;
    unsigned              maxLoopDepth = 0;
    unsigned              loopBlockCount = 0;
    InstGroup             dominantCategory = InstGroup::Other;
    std::vector<std::string> suggestions;
    std::string           loopSeverity = "None";  // None, Light, Moderate, Heavy
    double                o0Cost = 0.0;           // for comparison
    unsigned              o0Insts = 0;            // for comparison
};

//===----------------------------------------------------------------------===//
// LLVM Pass Definition
//===----------------------------------------------------------------------===//

namespace {

struct WeightedInstFreqPass : public FunctionPass {
    static char ID;

    std::map<InstGroup, double>  weights;
    std::ofstream                csvOut;
    std::ofstream                summaryOut;
    std::ofstream                jsonOut;
    bool                         headerWritten = false;
    std::vector<FuncResult>      allResults;
    std::map<std::string, std::pair<double, unsigned>> baselineMetrics;

    WeightedInstFreqPass() : FunctionPass(ID) {}

    // Called once before any function is processed
    bool doInitialization(Module &M) override {
        weights = loadWeights(WeightFile);

        // If compare mode is enabled, try to load the O0 baseline from an existing CSV
        if (CompareMode) {
            std::string baselinePath = BaselineCsv.empty() ? OutFile : BaselineCsv;
            baselineMetrics = parseBaselineCsv(baselinePath);
            if (baselineMetrics.empty()) {
                errs() << "[WeightedInstFreq] WARNING: compare-mode enabled but no baseline CSV found at '"
                       << baselinePath << "'. Comparison output will be skipped.\n";
            }
        }

        // Open CSV file
        csvOut.open(OutFile);
        if (!csvOut.is_open()) {
            errs() << "[WeightedInstFreq] ERROR: Cannot open output file '"
                   << OutFile << "'\n";
        } else {
            // Write CSV header
            csvOut << "function,basic_block,group,count,weight,cost,pct\n";
            headerWritten = true;
        }

        summaryOut.open(SummaryFile);
        if (!summaryOut.is_open()) {
            errs() << "[WeightedInstFreq] WARNING: Cannot open summary file '"
                   << SummaryFile << "'.\n";
        }

        jsonOut.open(JsonFile);
        if (!jsonOut.is_open()) {
            errs() << "[WeightedInstFreq] WARNING: Cannot open JSON file '"
                   << JsonFile << "'.\n";
        }

        errs() << "\n";
        errs() << "========================================\n";
        errs() << "  Weighted Instruction Frequency Pass  \n";
        errs() << "========================================\n";
        errs() << "  Weight file  : " << WeightFile << "\n";
        errs() << "  Hot threshold: " << HotThreshold << "\n";
        errs() << "  Output CSV   : " << OutFile << "\n";
        if (CompareMode) {
            errs() << "  Compare mode : enabled\n";
            errs() << "  Compare CSV  : " << CompareCsv << "\n";
        }
        errs() << "  Summary file : " << SummaryFile << "\n";
        errs() << "  JSON file    : " << JsonFile << "\n";
        errs() << "========================================\n\n";

        return false;
    }

    // Called after all functions are processed
    bool doFinalization(Module &M) override {
        if (csvOut.is_open()) csvOut.close();

        writeSummary();
        writeJson();
        if (CompareMode && !baselineMetrics.empty()) {
            writeComparisonCsv();
            writeOptimizationDelta();
        }

        errs() << "\n[WeightedInstFreq] Done. Results written to: " << OutFile << "\n";
        if (summaryOut.is_open()) errs() << "[WeightedInstFreq] Summary written to: " << SummaryFile << "\n";
        if (jsonOut.is_open()) errs() << "[WeightedInstFreq] JSON written to: " << JsonFile << "\n";
        if (CompareMode && !baselineMetrics.empty()) {
            errs() << "[WeightedInstFreq] Comparison CSV written to: " << CompareCsv << "\n";
            errs() << "[WeightedInstFreq] Delta CSV written to: " << CompareCsv << "_delta\n";
        }

        if (summaryOut.is_open()) summaryOut.close();
        if (jsonOut.is_open()) jsonOut.close();
        return false;
    }

    bool runOnFunction(Function &F) override {
        // Skip external declarations (no body)
        if (F.isDeclaration()) return false;

        FuncResult result;
        result.funcName = F.getName().str();

        // Initialize category counts to zero
        for (auto g : AllGroups) result.totalCounts[g] = 0;

        int bbIndex = 0;

        for (BasicBlock &BB : F) {
            BBResult bbRes;

            // Get a name for the basic block
            if (BB.hasName()) {
                bbRes.name = BB.getName().str();
            } else {
                bbRes.name = "BB" + std::to_string(bbIndex);
            }
            ++bbIndex;

            // Initialize per-BB counts to zero
            for (auto g : AllGroups) bbRes.counts[g] = 0;

            // Classify each instruction in this BB
            for (Instruction &I : BB) {
                InstGroup g = classifyInstruction(I);
                bbRes.counts[g]++;
                bbRes.totalCount++;
                result.totalCounts[g]++;
                result.totalInsts++;
            }

            result.blocks.push_back(bbRes);
        }

        // Compute total function cost and dominant category by weighted cost
        double bestCost = -1.0;
        for (auto g : AllGroups) {
            double cost = result.totalCounts[g] * weights.at(g);
            result.totalCost += cost;
            if (cost > bestCost) {
                bestCost = cost;
                result.dominantCategory = g;
            }
        }

        // Loop information from LLVM LoopInfo
        LoopInfo &LI = getAnalysis<LoopInfoWrapperPass>().getLoopInfo();
        std::set<const BasicBlock*> loopBlocks;
        unsigned totalLoops = 0;
        unsigned maxDepth = 0;
        for (Loop *L : LI)
            collectLoopMetrics(L, 1, totalLoops, maxDepth, loopBlocks);

        result.loopCount = totalLoops;
        result.maxLoopDepth = maxDepth;
        result.loopBlockCount = loopBlocks.size();
        result.loopSeverity = classifyLoopSeverity(totalLoops, maxDepth);

        // Store baseline metrics if available
        auto it = baselineMetrics.find(result.funcName);
        if (it != baselineMetrics.end()) {
            result.o0Cost = it->second.first;
            result.o0Insts = it->second.second;
        }
        if (result.totalCost > 0) {
            double memoryCost = result.totalCounts[InstGroup::Memory] * weights.at(InstGroup::Memory);
            double controlCost = result.totalCounts[InstGroup::ControlFlow] * weights.at(InstGroup::ControlFlow);
            double callCost = result.totalCounts[InstGroup::Call] * weights.at(InstGroup::Call);
            double memoryShare = memoryCost / result.totalCost;
            double controlShare = controlCost / result.totalCost;
            double callShare = callCost / result.totalCost;

            if (memoryShare >= 0.5)
                result.suggestions.push_back("High memory dominance; review data locality and memory access patterns.");
            if (controlShare >= 0.35)
                result.suggestions.push_back("Branch-heavy control flow; consider simplifying conditionals or loop exits.");
            if (callShare >= 0.25)
                result.suggestions.push_back("High function call overhead; inline hot callees or reduce call frequency.");
            if (result.loopCount > 0 && result.maxLoopDepth >= 2)
                result.suggestions.push_back("Nested loops detected; inner-loop optimization may improve performance.");
            else if (result.loopCount > 0)
                result.suggestions.push_back("Loops are present; consider loop-invariant motion and unrolling where safe.");
        }

        result.isHotspot = (result.totalCost >= HotThreshold);
        allResults.push_back(result);

        // Print results to terminal
        printFunctionResult(result);

        // Write to CSV
        if (headerWritten) writeCSV(result);

        return false; // analysis pass, no IR modification
    }

    //------------------------------------------------------------------------
    // Terminal output
    //------------------------------------------------------------------------

    void printFunctionResult(const FuncResult &res) {
        errs() << "┌─────────────────────────────────────────────────────────┐\n";
        errs() << "│ Function: " << res.funcName;
        // Pad to align the box
        int pad = 47 - (int)res.funcName.size();
        for (int i = 0; i < pad; i++) errs() << " ";
        errs() << " │\n";
        errs() << "├──────────────┬────────┬────────┬──────────┬────────────┤\n";
        errs() << "│ Category     │ Count  │ Weight │   Cost   │    Pct     │\n";
        errs() << "├──────────────┼────────┼────────┼──────────┼────────────┤\n";

        for (auto g : AllGroups) {
            unsigned count = res.totalCounts.at(g);
            double   w     = weights.at(g);
            double   cost  = count * w;
            double   pct   = (res.totalCost > 0) ? (cost / res.totalCost * 100.0) : 0.0;

            std::string gn = groupName(g);
            // Pad group name
            errs() << "│ " << gn;
            for (int i = 0; i < 12 - (int)gn.size(); i++) errs() << " ";

            // Format numbers neatly
            char buf[128];
            snprintf(buf, sizeof(buf), " │ %6u │ %6.1f │ %8.2f │ %8.2f%%  │\n",
                     count, w, cost, pct);
            errs() << buf;
        }

        errs() << "├──────────────┼────────┼────────┼──────────┼────────────┤\n";
        char totbuf[128];
        snprintf(totbuf, sizeof(totbuf),
                 "│ TOTAL        │ %6u │        │ %8.2f │ 100.00%%  │\n",
                 res.totalInsts, res.totalCost);
        errs() << totbuf;
        errs() << "└──────────────┴────────┴────────┴──────────┴────────────┘\n";

        // Basic-block breakdown
        errs() << "\n  Basic Block Cost Breakdown:\n";
        errs() << "  " << std::string(55, '-') << "\n";
        for (const auto &bb : res.blocks) {
            double bbCost = 0.0;
            for (auto g : AllGroups)
                bbCost += bb.counts.at(g) * weights.at(g);

            char bbuf[128];
            snprintf(bbuf, sizeof(bbuf), "  %-20s  insts: %4u   cost: %8.2f\n",
                     bb.name.c_str(), bb.totalCount, bbCost);
            errs() << bbuf;
        }
        errs() << "  " << std::string(55, '-') << "\n";

        errs() << "  Dominant category: " << groupName(res.dominantCategory) << "\n";
        errs() << "  Loop metrics     : total loops=" << res.loopCount
               << ", max nesting=" << res.maxLoopDepth
               << ", loop blocks=" << res.loopBlockCount << "\n";
        errs() << "  Loop severity    : " << res.loopSeverity << "\n";

        if (!res.suggestions.empty()) {
            errs() << "  Suggestions:\n";
            for (const auto &suggestion : res.suggestions)
                errs() << "    - " << suggestion << "\n";
        }

        // Hotspot warning
        if (res.isHotspot) {
            errs() << "\n  *** HOTSPOT DETECTED *** Function '" << res.funcName
                   << "' has weighted cost " << res.totalCost
                   << " >= threshold " << HotThreshold << "\n";
        }
        errs() << "\n";
    }

    //------------------------------------------------------------------------
    // CSV output
    //------------------------------------------------------------------------

    void writeCSV(const FuncResult &res) {
        // Function-level summary rows
        for (auto g : AllGroups) {
            unsigned count = res.totalCounts.at(g);
            double   w     = weights.at(g);
            double   cost  = count * w;
            double   pct   = (res.totalCost > 0) ? (cost / res.totalCost * 100.0) : 0.0;

            csvOut << res.funcName << ","
                   << "FUNCTION_TOTAL" << ","
                   << groupName(g) << ","
                   << count << ","
                   << w << ","
                   << std::fixed << std::setprecision(2) << cost << ","
                   << std::fixed << std::setprecision(2) << pct << "\n";
        }

        // Basic-block rows
        for (const auto &bb : res.blocks) {
            for (auto g : AllGroups) {
                unsigned count = bb.counts.at(g);
                double   w     = weights.at(g);
                double   cost  = count * w;
                // pct relative to function total cost
                double   pct   = (res.totalCost > 0) ? (cost / res.totalCost * 100.0) : 0.0;

                csvOut << res.funcName << ","
                       << bb.name << ","
                       << groupName(g) << ","
                       << count << ","
                       << w << ","
                       << std::fixed << std::setprecision(2) << cost << ","
                       << std::fixed << std::setprecision(2) << pct << "\n";
            }
        }
    }

    void writeSummary() {
        if (!summaryOut.is_open()) return;

        double totalModuleCost = 0.0;
        unsigned totalLoops = 0;
        unsigned maxLoopDepth = 0;
        unsigned totalLoopBlocks = 0;
        std::string highestFunc;
        double highestCost = -1.0;

        for (const auto &res : allResults) {
            totalModuleCost += res.totalCost;
            totalLoops += res.loopCount;
            maxLoopDepth = std::max(maxLoopDepth, res.maxLoopDepth);
            totalLoopBlocks += res.loopBlockCount;
            if (res.totalCost > highestCost) {
                highestCost = res.totalCost;
                highestFunc = res.funcName;
            }
        }

        summaryOut << "Weighted Instruction Frequency Summary\n";
        summaryOut << "========================================\n";
        summaryOut << "Functions analyzed: " << allResults.size() << "\n";
        summaryOut << "Total weighted cost: " << std::fixed << std::setprecision(2) << totalModuleCost << "\n";
        summaryOut << "Highest cost function: " << highestFunc << " (" << highestCost << ")\n";
        summaryOut << "Total loops in module: " << totalLoops << "\n";
        summaryOut << "Deepest loop nesting: " << maxLoopDepth << "\n";
        summaryOut << "Total loop blocks: " << totalLoopBlocks << "\n\n";

        for (const auto &res : allResults) {
            summaryOut << "Function: " << res.funcName << "\n";
            summaryOut << "  Total instructions : " << res.totalInsts << "\n";
            summaryOut << "  Weighted cost      : " << std::fixed << std::setprecision(2) << res.totalCost << "\n";
            summaryOut << "  Dominant category  : " << groupName(res.dominantCategory) << "\n";
            summaryOut << "  Total loops        : " << res.loopCount << "\n";
            summaryOut << "  Max loop nesting   : " << res.maxLoopDepth << "\n";
            summaryOut << "  Loop blocks        : " << res.loopBlockCount << "\n";
            summaryOut << "  Loop severity      : " << res.loopSeverity << "\n";
            if (!res.suggestions.empty()) {
                summaryOut << "  Suggestions:\n";
                for (const auto &suggestion : res.suggestions)
                    summaryOut << "    - " << suggestion << "\n";
            }
            summaryOut << "\n";
        }
    }

    void writeJson() {
        if (!jsonOut.is_open()) return;

        double totalModuleCost = 0.0;
        unsigned totalLoops = 0;
        unsigned maxLoopDepth = 0;
        unsigned totalLoopBlocks = 0;
        std::string highestFunc;
        double highestCost = -1.0;

        for (const auto &res : allResults) {
            totalModuleCost += res.totalCost;
            totalLoops += res.loopCount;
            maxLoopDepth = std::max(maxLoopDepth, res.maxLoopDepth);
            totalLoopBlocks += res.loopBlockCount;
            if (res.totalCost > highestCost) {
                highestCost = res.totalCost;
                highestFunc = res.funcName;
            }
        }

        jsonOut << "{\n";
        jsonOut << "  \"module_summary\": {\n";
        jsonOut << "    \"total_functions\": " << allResults.size() << ",\n";
        jsonOut << "    \"total_cost\": " << std::fixed << std::setprecision(2) << totalModuleCost << ",\n";
        jsonOut << "    \"highest_cost_function\": \"" << escapeJsonString(highestFunc) << "\",\n";
        jsonOut << "    \"highest_cost\": " << std::fixed << std::setprecision(2) << highestCost << ",\n";
        jsonOut << "    \"total_loops\": " << totalLoops << ",\n";
        jsonOut << "    \"max_loop_depth\": " << maxLoopDepth << ",\n";
        jsonOut << "    \"loop_blocks\": " << totalLoopBlocks << "\n";
        jsonOut << "  },\n";
        jsonOut << "  \"functions\": [\n";

        for (size_t idx = 0; idx < allResults.size(); ++idx) {
            const auto &res = allResults[idx];
            jsonOut << "    {\n";
            jsonOut << "      \"function\": \"" << escapeJsonString(res.funcName) << "\",\n";
            jsonOut << "      \"total_insts\": " << res.totalInsts << ",\n";
            jsonOut << "      \"total_cost\": " << std::fixed << std::setprecision(2) << res.totalCost << ",\n";
            jsonOut << "      \"dominant_category\": \"" << groupName(res.dominantCategory) << "\",\n";
            jsonOut << "      \"loop_count\": " << res.loopCount << ",\n";
            jsonOut << "      \"max_loop_depth\": " << res.maxLoopDepth << ",\n";
            jsonOut << "      \"loop_blocks\": " << res.loopBlockCount << ",\n";
            jsonOut << "      \"loop_severity\": \"" << res.loopSeverity << "\",\n";
            jsonOut << "      \"is_hotspot\": " << (res.isHotspot ? "true" : "false") << ",\n";
            jsonOut << "      \"suggestions\": [";
            for (size_t si = 0; si < res.suggestions.size(); ++si) {
                jsonOut << "\"" << escapeJsonString(res.suggestions[si]) << "\"";
                if (si + 1 < res.suggestions.size()) jsonOut << ", ";
            }
            jsonOut << "]\n";
            jsonOut << "    }" << (idx + 1 < allResults.size() ? "," : "") << "\n";
        }

        jsonOut << "  ]\n";
        jsonOut << "}\n";
    }

    void writeComparisonCsv() {
        if (!CompareMode || baselineMetrics.empty()) return;

        std::ofstream compareOut(CompareCsv);
        if (!compareOut.is_open()) {
            errs() << "[WeightedInstFreq] WARNING: Cannot open comparison CSV '"
                   << CompareCsv << "'\n";
            return;
        }

        compareOut << "function,O0_cost,O2_cost,reduction_pct,O0_insts,O2_insts,loop_severity\n";
        for (const auto &res : allResults) {
            auto it = baselineMetrics.find(res.funcName);
            if (it == baselineMetrics.end()) continue;
            double o0Cost = it->second.first;
            unsigned o0Insts = it->second.second;
            double reductionPct = o0Cost > 0.0
                ? ((o0Cost - res.totalCost) / o0Cost) * 100.0
                : 0.0;
            compareOut << res.funcName << ","
                       << std::fixed << std::setprecision(2) << o0Cost << ","
                       << res.totalCost << ","
                       << reductionPct << ","
                       << o0Insts << ","
                       << res.totalInsts << ","
                       << res.loopSeverity << "\n";
        }
    }

    void writeOptimizationDelta() {
        if (!CompareMode || baselineMetrics.empty()) return;

        std::string deltaPath = CompareCsv;
        // Replace suffix: optimization_comparison.csv -> optimization_delta.csv
        size_t dotPos = deltaPath.find_last_of('.');
        if (dotPos != std::string::npos) {
            deltaPath = deltaPath.substr(0, dotPos);
        }
        deltaPath += "_delta.csv";

        std::ofstream deltaOut(deltaPath);
        if (!deltaOut.is_open()) {
            errs() << "[WeightedInstFreq] WARNING: Cannot open delta CSV '"
                   << deltaPath << "'\n";
            return;
        }

        deltaOut << "function,O0_cost,O2_cost,cost_delta,reduction_pct,O0_insts,O2_insts,inst_delta,loop_severity\n";
        for (const auto &res : allResults) {
            auto it = baselineMetrics.find(res.funcName);
            if (it == baselineMetrics.end()) continue;
            double o0Cost = it->second.first;
            unsigned o0Insts = it->second.second;
            double costDelta = o0Cost - res.totalCost;
            long instDelta = (long)o0Insts - (long)res.totalInsts;
            double reductionPct = o0Cost > 0.0
                ? ((o0Cost - res.totalCost) / o0Cost) * 100.0
                : 0.0;

            deltaOut << res.funcName << ","
                     << std::fixed << std::setprecision(2) << o0Cost << ","
                     << res.totalCost << ","
                     << costDelta << ","
                     << reductionPct << ","
                     << o0Insts << ","
                     << res.totalInsts << ","
                     << instDelta << ","
                     << res.loopSeverity << "\n";
        }
    }

    void getAnalysisUsage(AnalysisUsage &AU) const override {
        AU.setPreservesAll(); // pure analysis, no IR changes
        AU.addRequired<LoopInfoWrapperPass>();
    }
};

} // anonymous namespace

char WeightedInstFreqPass::ID = 0;

// Register the pass with opt
static RegisterPass<WeightedInstFreqPass> X(
    "weighted-inst-freq",
    "Weighted Instruction Frequency Analysis Pass",
    false, // CFGOnly
    true   // isAnalysis
);

// Auto-register with the legacy pass manager pipeline
static RegisterStandardPasses Y(
    PassManagerBuilder::EP_EarlyAsPossible,
    [](const PassManagerBuilder &, legacy::PassManagerBase &PM) {
        PM.add(new WeightedInstFreqPass());
    }
);