# Portfolio Recommendation — Antarctica AM

## Overview

This application generates a portfolio reallocation recommendation for Q2 2026 based on historical asset data, balancing return and risk under imperfect and inconsistent data conditions.

The goal is not to produce a theoretically flawless mathematical model, but a **robust, interpretable, and production-ready recommendation system**.

---

## Problem Framing

**Given:**
* Current portfolio holdings (Q1 2026)
* Historical daily price data
* A benchmark index
* A set of soft diversification constraints

**The Task:**
Recommend new asset weights for the next period.

**Key Challenge:**
> The optimization objective and data assumptions are under-specified, and the raw data contains anomalies.

This implementation adopts a **practical, risk-adjusted approach**, prioritizing stability, defensive data engineering, and explainability.

---

## Approach

### 1. Risk Model
Assets are scored using a simplified risk-adjusted return metric:
* Return (monthly)
* Volatility (monthly standard deviation)
* **Score = Return / Volatility (Sharpe Ratio)**

*Why?* This provides a straightforward and intuitive measure of risk-adjusted performance. It remains highly stable and interpretable even when dealing with noisy or truncated inputs, avoiding the fragility of more complex models.

### 2. Data Completeness Adjustment (The Recency Trap)
Assets in this dataset have inconsistent availability (e.g., Aegis Partners is missing the last 6 months of data).
Instead of silently excluding the asset or projecting fake data, this implementation introduces a **Recency-Aware Confidence Penalty**:
* Each asset uses its available history to compute a raw Sharpe score.
* The score is then penalized proportionally based on missing *recent* trading days.
* *Why?* For a forward-looking recommendation, missing recent data is far more damaging than missing early data. This degrades the asset gracefully rather than crashing the model.

### 3. Portfolio Construction & Constraint Conflict
1. Compute monthly returns and adjusted scores.
2. Select the top assets using a greedy heuristic that respects asset class caps.
3. Allocate weights proportionally.
4. Apply iterative constraint enforcement (clipping bounds, class caps).

**The Cash Drag Dilemma:**
The provided constraints are mathematically conflicting (`max_assets: 5` combined with `max_weight: 0.25` and class caps of `0.30` create a hard floor of 15%-20% unallocated cash).

**Strategic Decision:**
Rather than hacking the weights to force a 100% allocation, the system makes a transparent, data-backed decision: **Strategic Constraint Relaxation**. 
We dynamically relaxed the `max_assets` limit from 5 to 6. This reduces the cash drag from 20% to 15% (the absolute mathematical limit) while actively improving portfolio diversification without introducing concentration risk.

---

## Data Quality Strategy

A deep diagnostic probe (`docs/data-exploration.md`) revealed 13 critical data quality issues before any optimization code was written.

**Identified Traps:**
* Mixed date formats (ISO, Excel serial, DD/MM/YYYY, ISO timestamp)
* 20% of numeric prices encoded as strings
* Duplicate ISINs with conflicting names
* Invalid AWS regions for the Benchmark URL (`eu-east-1` -> `eu-west-1`)
* Statistical price outliers

**Resolution Strategy:**
A rigid Server-Side validation pipeline (Next.js RSC + Zod):
* Consistent parsing and runtime coercion.
* Normalized domain representation.
* Explicit handling of anomalies (e.g., merging duplicates by summing weights).

**Key Principle:**
> Data issues are not hidden — they are explicitly surfaced to the user in a diagnostic UI panel.

---

## Product Design

The application is designed as a professional internal tool, not a quick prototype.

### Features
* **Summary First Principle:** The "Quick Summary" surfaces the bottom-line recommendations and strategic rule-breaking immediately at the top.
* **Diagnostic Dashboard:** A real-time Data Quality & Constraint Compliance panel proves the engine handled edge cases correctly.
* **Accessible Visualizations:** Screen-reader-only (`sr-only`) data tables run parallel to Recharts SVGs, ensuring A11y compliance.
* **Refined Typography:** Tabular numbers and Antarctica's corporate palette (`#002D54`) elevate the visual hierarchy.

---

## Future Improvements (With More Time)
* **Advanced Optimization Strategies:** Introduce more sophisticated allocation algorithms (e.g., risk parity or models with penalty parameters) to further enhance the strategy's robustness and capital deployment efficiency in complex market environments.
* **Turnover Penalty:** Incorporate transaction cost modeling to penalize drastic weight shifts from the current holdings.
* **Benchmark Integration:** Transition from absolute Sharpe ratio to Information Ratio (IR) to optimize for active return relative to the benchmark.
* **UI & Data Visualization Enhancements:** Further polish the dashboard design, expand on interactive charts (e.g., historical drawdowns, asset correlation matrices), and provide richer contextual tooltips to elevate the overall user experience.

---

## Running Locally

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Tech Stack
Next.js 16, TypeScript, Tailwind CSS, Zod, Recharts, ESLint (jsx-a11y)
