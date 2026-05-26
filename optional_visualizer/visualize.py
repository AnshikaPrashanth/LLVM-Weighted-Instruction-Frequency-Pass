#!/usr/bin/env python3
"""
visualize.py — Weighted Instruction Frequency Visualizer

Reads results.csv produced by the WeightedInstFreq LLVM pass and
generates a bar chart showing weighted cost contribution per category
for each function.

Usage:
    python3 visualize.py [path/to/results.csv]

Output:
    cost_plot.png  (saved in current directory)

Requirements:
    pip install pandas matplotlib
"""

import sys
import os
import pandas as pd
import matplotlib
matplotlib.use("Agg")   # Non-interactive backend (no GUI needed)
import matplotlib.pyplot as plt
import matplotlib.cm as cm
import numpy as np

# ──────────────────────────────────────────────────────────────────────────────
# Configuration
# ──────────────────────────────────────────────────────────────────────────────

OUTPUT_FILE = "cost_plot.png"
DPI         = 150

CATEGORY_COLORS = {
    "Arithmetic":  "#4C72B0",
    "Memory":      "#DD8452",
    "ControlFlow": "#55A868",
    "Call":        "#C44E52",
    "Cast":        "#8172B3",
    "Comparison":  "#937860",
    "Other":       "#DA8BC3",
}

# ──────────────────────────────────────────────────────────────────────────────
# Load & validate data
# ──────────────────────────────────────────────────────────────────────────────

def load_data() -> pd.DataFrame:
    paths = []
    if len(sys.argv) > 1:
        paths = [sys.argv[1]]
    else:
        # Auto-detect all testcase CSV files in results/O0 or ../results/O0
        candidates = [
            "results/O0/*_results.csv",
            "../results/O0/*_results.csv",
            "results.csv",
            "../results.csv"
        ]
        import glob
        for pattern in candidates:
            found = glob.glob(pattern)
            if found:
                paths = found
                break
                
    if not paths:
        print("[visualize] ERROR: No CSV data found. Please run the pass or pass a CSV file.")
        print("Usage: python3 visualize.py [path/to/results.csv]")
        sys.exit(1)

    dfs = []
    for path in paths:
        if os.path.exists(path):
            df = pd.read_csv(path)
            required = {"function", "basic_block", "group", "count", "weight", "cost", "pct"}
            missing = required - set(df.columns)
            if missing:
                print(f"[visualize] WARNING: CSV {path} missing columns: {missing}. Skipping.")
                continue
            # For multiple testcases, prepend testcase name to function to keep them unique
            if len(paths) > 1:
                tc_name = os.path.basename(path).replace("_results.csv", "")
                df["function"] = tc_name + ":" + df["function"]
            dfs.append(df)
            print(f"[visualize] Loaded {len(df)} rows from: {path}")

    if not dfs:
        print("[visualize] ERROR: No valid data could be loaded.")
        sys.exit(1)
        
    return pd.concat(dfs, ignore_index=True)

# ──────────────────────────────────────────────────────────────────────────────
# Plot 1: Stacked bar chart — cost per function, coloured by category
# ──────────────────────────────────────────────────────────────────────────────

def plot_function_cost(df: pd.DataFrame, ax: plt.Axes) -> None:
    # Use only function-level summary rows
    func_df = df[df["basic_block"] == "FUNCTION_TOTAL"].copy()

    functions  = func_df["function"].unique()
    categories = list(CATEGORY_COLORS.keys())

    # Pivot: rows=functions, cols=categories, values=cost
    pivot = func_df.pivot_table(
        index="function", columns="group", values="cost", aggfunc="sum", fill_value=0
    )
    # Ensure all categories present (may be 0)
    for cat in categories:
        if cat not in pivot.columns:
            pivot[cat] = 0
    pivot = pivot[categories]     # enforce column order

    x     = np.arange(len(pivot))
    width = 0.6

    bottoms = np.zeros(len(pivot))
    for cat in categories:
        vals   = pivot[cat].values
        color  = CATEGORY_COLORS.get(cat, "#999999")
        bars   = ax.bar(x, vals, width, bottom=bottoms, label=cat, color=color)
        # Label non-zero segments
        for bar, v in zip(bars, vals):
            if v > 0:
                cx = bar.get_x() + bar.get_width() / 2
                cy = bar.get_y() + bar.get_height() / 2
                ax.text(cx, cy, f"{v:.0f}", ha="center", va="center",
                        fontsize=7, color="white", fontweight="bold")
        bottoms += vals

    ax.set_xticks(x)
    ax.set_xticklabels(pivot.index, rotation=30, ha="right", fontsize=9)
    ax.set_ylabel("Weighted Cost", fontsize=10)
    ax.set_title("Weighted Cost per Function (by Category)", fontsize=12, fontweight="bold")
    ax.legend(loc="upper right", fontsize=8, framealpha=0.8)
    ax.grid(axis="y", linestyle="--", alpha=0.4)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)

# ──────────────────────────────────────────────────────────────────────────────
# Plot 2: Pie chart — overall cost split by category across all functions
# ──────────────────────────────────────────────────────────────────────────────

def plot_category_pie(df: pd.DataFrame, ax: plt.Axes) -> None:
    func_df = df[df["basic_block"] == "FUNCTION_TOTAL"]
    total_by_cat = func_df.groupby("group")["cost"].sum()
    total_by_cat = total_by_cat[total_by_cat > 0]

    colors = [CATEGORY_COLORS.get(c, "#aaaaaa") for c in total_by_cat.index]

    wedges, texts, autotexts = ax.pie(
        total_by_cat.values,
        labels=total_by_cat.index,
        colors=colors,
        autopct="%1.1f%%",
        startangle=140,
        pctdistance=0.75,
    )
    for t in autotexts:
        t.set_fontsize(8)

    ax.set_title("Overall Cost Distribution by Category", fontsize=12, fontweight="bold")

# ──────────────────────────────────────────────────────────────────────────────
# Plot 3: Grouped bar — top basic blocks by cost (across all functions)
# ──────────────────────────────────────────────────────────────────────────────

def plot_top_blocks(df: pd.DataFrame, ax: plt.Axes, top_n: int = 12) -> None:
    bb_df = df[df["basic_block"] != "FUNCTION_TOTAL"].copy()

    # Total cost per (function, block) pair
    bb_total = (
        bb_df.groupby(["function", "basic_block"])["cost"]
        .sum()
        .reset_index()
        .sort_values("cost", ascending=False)
        .head(top_n)
    )

    labels = [f"{r.function}\n{r.basic_block}" for _, r in bb_total.iterrows()]
    costs  = bb_total["cost"].values
    colors = cm.RdYlGn_r(np.linspace(0.2, 0.9, len(costs)))

    bars = ax.barh(range(len(labels)), costs, color=colors, edgecolor="white", linewidth=0.5)
    ax.set_yticks(range(len(labels)))
    ax.set_yticklabels(labels, fontsize=8)
    ax.set_xlabel("Weighted Cost", fontsize=10)
    ax.set_title(f"Top {top_n} Basic Blocks by Cost", fontsize=12, fontweight="bold")
    ax.invert_yaxis()   # highest cost at top
    ax.grid(axis="x", linestyle="--", alpha=0.4)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)

    for bar, v in zip(bars, costs):
        ax.text(bar.get_width() + 0.3, bar.get_y() + bar.get_height() / 2,
                f"{v:.1f}", va="center", fontsize=8)

# ──────────────────────────────────────────────────────────────────────────────
# Summary table printed to console
# ──────────────────────────────────────────────────────────────────────────────

def print_summary(df: pd.DataFrame) -> None:
    func_df = df[df["basic_block"] == "FUNCTION_TOTAL"]
    summary = (
        func_df.groupby("function")["cost"]
        .sum()
        .sort_values(ascending=False)
        .reset_index()
    )
    summary.columns = ["Function", "Total Weighted Cost"]
    print("\n── Function Cost Summary ──────────────────────")
    print(summary.to_string(index=False))
    print("───────────────────────────────────────────────\n")

# ──────────────────────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────────────────────

def main():
    df = load_data()
    print_summary(df)

    fig = plt.figure(figsize=(16, 12))
    fig.suptitle("Weighted Instruction Frequency Analysis", fontsize=15, fontweight="bold", y=0.98)

    # Layout: top row = stacked bar (wide), bottom row = pie + top-blocks
    ax1 = fig.add_subplot(2, 1, 1)
    ax2 = fig.add_subplot(2, 2, 3)
    ax3 = fig.add_subplot(2, 2, 4)

    plot_function_cost(df, ax1)
    plot_category_pie(df, ax2)
    plot_top_blocks(df, ax3)

    plt.tight_layout(rect=[0, 0, 1, 0.96])
    plt.savefig(OUTPUT_FILE, dpi=DPI, bbox_inches="tight")
    print(f"[visualize] Chart saved to: {OUTPUT_FILE}")

if __name__ == "__main__":
    main()