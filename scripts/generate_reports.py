#!/usr/bin/env python3
# scripts/generate_reports.py
# Aggregates results from O0 and O2 analysis to generate optimization_comparison.csv and evaluation_summary.csv.

import os
import csv
import glob

def analyze_csv(filepath):
    if not os.path.exists(filepath):
        return None
    
    functions = set()
    basic_blocks = set()
    total_insts = 0
    total_cost = 0.0
    
    func_costs = {}
    category_costs = {}
    
    with open(filepath, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            func = row['function']
            bb = row['basic_block']
            group = row['group']
            count = int(row['count'])
            cost = float(row['cost'])
            
            functions.add(func)
            if bb != "FUNCTION_TOTAL":
                basic_blocks.add((func, bb))
            else:
                total_insts += count
                total_cost += cost
                
                func_costs[func] = func_costs.get(func, 0.0) + cost
                category_costs[group] = category_costs.get(group, 0.0) + cost
                
    hottest_func = max(func_costs, key=func_costs.get) if func_costs else "N/A"
    dominant_cat = max(category_costs, key=category_costs.get) if category_costs else "N/A"
    
    return {
        'function_count': len(functions),
        'basic_block_count': len(basic_blocks),
        'raw_instruction_count': total_insts,
        'total_weighted_cost': round(total_cost, 2),
        'hottest_function': hottest_func,
        'dominant_category': dominant_cat
    }

def main():
    results_dir = "results"
    o0_dir = os.path.join(results_dir, "O0")
    o2_dir = os.path.join(results_dir, "O2")
    comparison_dir = os.path.join(results_dir, "comparison")
    os.makedirs(comparison_dir, exist_ok=True)
    
    # Find all testcase basenames by looking for results CSVs
    o0_files = glob.glob(os.path.join(o0_dir, "*_results.csv"))
    testcases = sorted([os.path.basename(f).replace("_results.csv", "") for f in o0_files])
    
    # 1. Generate optimization_comparison.csv
    comp_fields = [
        "testcase", "opt_level", "function_count", "basic_block_count", 
        "raw_instruction_count", "total_weighted_cost", "hottest_function", "dominant_category"
    ]
    
    comp_rows = []
    summary_rows = []
    
    for tc in testcases:
        o0_path = os.path.join(o0_dir, f"{tc}_results.csv")
        o2_path = os.path.join(o2_dir, f"{tc}_results.csv")
        
        o0_metrics = analyze_csv(o0_path)
        o2_metrics = analyze_csv(o2_path)
        
        if o0_metrics:
            comp_rows.append({
                "testcase": tc,
                "opt_level": "O0",
                "function_count": o0_metrics['function_count'],
                "basic_block_count": o0_metrics['basic_block_count'],
                "raw_instruction_count": o0_metrics['raw_instruction_count'],
                "total_weighted_cost": o0_metrics['total_weighted_cost'],
                "hottest_function": o0_metrics['hottest_function'],
                "dominant_category": o0_metrics['dominant_category']
            })
            
        if o2_metrics:
            comp_rows.append({
                "testcase": tc,
                "opt_level": "O2",
                "function_count": o2_metrics['function_count'],
                "basic_block_count": o2_metrics['basic_block_count'],
                "raw_instruction_count": o2_metrics['raw_instruction_count'],
                "total_weighted_cost": o2_metrics['total_weighted_cost'],
                "hottest_function": o2_metrics['hottest_function'],
                "dominant_category": o2_metrics['dominant_category']
            })
            
        # Evaluation Summary calculation
        if o0_metrics and o2_metrics:
            inst_red = ((o0_metrics['raw_instruction_count'] - o2_metrics['raw_instruction_count']) / o0_metrics['raw_instruction_count'] * 100.0) if o0_metrics['raw_instruction_count'] > 0 else 0.0
            cost_red = ((o0_metrics['total_weighted_cost'] - o2_metrics['total_weighted_cost']) / o0_metrics['total_weighted_cost'] * 100.0) if o0_metrics['total_weighted_cost'] > 0.0 else 0.0
            
            summary_rows.append({
                "testcase": tc,
                "O0_insts": o0_metrics['raw_instruction_count'],
                "O2_insts": o2_metrics['raw_instruction_count'],
                "inst_reduction_pct": f"{inst_red:.2f}%",
                "O0_cost": o0_metrics['total_weighted_cost'],
                "O2_cost": o2_metrics['total_weighted_cost'],
                "cost_reduction_pct": f"{cost_red:.2f}%",
                "hottest_function": o2_metrics['hottest_function'],
                "dominant_category": o2_metrics['dominant_category']
            })
            
    # Write optimization_comparison.csv
    comp_file_path = os.path.join(comparison_dir, "optimization_comparison.csv")
    with open(comp_file_path, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=comp_fields)
        writer.writeheader()
        writer.writerows(comp_rows)
        
    # Write evaluation_summary.csv
    sum_fields = [
        "testcase", "O0_insts", "O2_insts", "inst_reduction_pct", 
        "O0_cost", "O2_cost", "cost_reduction_pct", "hottest_function", "dominant_category"
    ]
    sum_file_path = os.path.join(comparison_dir, "evaluation_summary.csv")
    with open(sum_file_path, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=sum_fields)
        writer.writeheader()
        writer.writerows(summary_rows)

    print("Consolidated reports generated successfully!")
    print(f"  - {comp_file_path}")
    print(f"  - {sum_file_path}")

if __name__ == "__main__":
    main()
