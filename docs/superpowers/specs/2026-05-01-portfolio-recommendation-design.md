# Portfolio Recommendation App — Design Spec

## Overview

A Next.js application that reads Antarctica's portfolio data (holdings, prices, benchmark, constraints), produces recommended weights for the next period using a Sharpe-based heuristic, and displays the recommendation with explanatory charts. Deployed on Vercel.

**Optimization objective:** Maximize risk-adjusted return (Sharpe ratio) under soft business constraints, using monthly returns.

**Core principle:** Simple, robust, explainable. Every decision in this system should be defensible in a 30-minute debrief.

**Language:** All code, comments, commit messages, documentation, and UI copy must be in English.

---

## 0. Data Exploration & Decision Log

### Purpose

Before writing any pipeline or algorithm code, we inspect all four data sources, document every quality issue found, and record the resolution decision with rationale. This is committed as the **first meaningful commit** after project setup — proving that data analysis preceded implementation.

### Deliverable: `docs/data-exploration.md`

A standalone document committed early in git history. Structure:

```
# Data Exploration Log

## Overview
Summary of all four data sources: record counts, date ranges, field structures.

## Holdings
- 11 records, 10 unique ISINs
- Issues found: [list each with resolution + rationale]

## Prices
- 7,489 records, 10 ISINs, 2023-04-05 to 2026-03-31
- Issues found: [list each with resolution + rationale]

## Benchmark
- 762 records (after dedup: 756 unique dates)
- URL discovery: eu-east-1 → eu-west-1
- Issues found: [list each with resolution + rationale]

## Constraints
- Feasibility analysis: current portfolio already violates caps
- Issues found: [list each with resolution + rationale]

## Key Decisions
1. Optimization objective: Sharpe ratio (risk-adjusted return)
2. Truncated asset handling: recency-aware confidence penalty
3. Unallocated weight: explicit Cash representation
4. Benchmark: visual reference, not optimization target
5. Constraint treatment: soft, with Cash as feasibility buffer
```

### Why this matters

Most candidates jump straight into code. Committing a data exploration doc first signals:
- You inspect before you build
- Your decisions have documented rationale
- A colleague could "pick up and reason about" your work (the brief's exact words)

---

## 1. Data Pipeline

### Architecture

```
Raw JSON (S3 URLs)
  → Parse Layer (format unification)
  → Validate Layer (Zod runtime schemas)
  → Normalize Layer (business standardization)
  → Typed Domain Model (UI consumes this)
```

All data processing happens server-side (Next.js Server Components / API routes). The client never touches raw data.

### Data Sources

| File | URL | Notes |
|------|-----|-------|
| Holdings | `s3.eu-west-1.amazonaws.com/.../holdings.json` | Current portfolio |
| Prices | `s3.eu-west-1.amazonaws.com/.../prices.json` | 7,489 records, tall format |
| Benchmark | `s3.eu-west-1.amazonaws.com/.../benchmark.json` | 762 records. README URL uses `eu-east-1` (invalid region); correct URL is `eu-west-1` |
| Constraints | `s3.eu-west-1.amazonaws.com/.../constraints.json` | Soft constraints |

### Data Quality Issues — Complete List (13 items)

#### Holdings (5 issues)

| # | Issue | Detection | Resolution |
|---|-------|-----------|------------|
| 1 | Duplicate ISIN `NTA002E0002` — "Coralis Holdings" and "Coralis Group" with identical weights (0.04) | Schema validation: unique ISIN check | Merge into one record, sum weights (0.08), take first name, log warning |
| 2 | `asset_class` has 6 variant spellings: `Equity`, `equity`, `Fixed Income`, `fixed-income`, `FI`, `Alternatives` | Normalization mapping | Map to 3 canonical values matching constraints keys: `Equity`, `Fixed Income`, `Alternatives` |
| 3 | Currency format: `US$` (NTA004E0004) vs `USD` vs `EUR` | Normalization mapping | Map `US$` → `USD` |
| 4 | Weights sum to 0.98 (after ISIN dedup, still 0.98) | Post-normalization validation | Display remainder as "Unallocated Cash" — explicit representation over implicit correction |
| 5 | Current allocation already violates constraints: Equity 0.38 (cap 0.30), Fixed Income 0.35 (cap 0.30) | Cross-reference with constraints | Display in UI as context for why rebalancing is needed |

#### Prices (5 issues)

| # | Issue | Detection | Resolution |
|---|-------|-----------|------------|
| 6 | 4 date formats: `YYYY-MM-DD` (7,480), Excel serial int (2), `DD/MM/YYYY` (3), ISO 8601 timestamp (4) | `parseDate()` with format detection | Unified parser handles all 4 formats; unparseable records logged and skipped |
| 7 | 20.2% of prices are strings (1,513 of 7,489) | Zod schema | Use `z.coerce.number()` for automatic conversion; NaN → skip with warning |
| 8 | NTA004E0004 (Aegis Partners) truncated at 2025-09-29 — missing last ~6 months | Record count comparison across ISINs | Recency-aware confidence penalty (see Optimization section) |
| 9 | NTA001E0001 missing 5 trading days vs other ISINs | Gap detection | Forward fill — minimal impact on monthly returns |
| 10 | NTA008A0008 has suspicious price 4695.2893 on 2024-03-12 (ISO timestamp record) | Statistical outlier detection (z-score) | Check against asset's price distribution; if >3 sigma, exclude data point with warning |

#### Benchmark (2 issues)

| # | Issue | Detection | Resolution |
|---|-------|-----------|------------|
| 11 | README URL uses `eu-east-1` (invalid AWS region) | Connection failure | Use `eu-west-1` (same region as other files). Document discovery in README |
| 12 | 6 duplicate dates with conflicting level values (max diff: 22.6 points) | Unique date check | Last entry wins (convention: later entry = correction). Log each duplicate |

#### Constraints (1 issue)

| # | Issue | Detection | Resolution |
|---|-------|-----------|------------|
| 13 | `per_asset_class_caps` sum to 0.90, not 1.0 | Sum validation | Remaining 10% can be allocated to Cash. Consistent with cash treatment elsewhere |

### Technical Choices

- **Zod** for runtime schema validation (not just TypeScript static types)
- Each cleaning step produces a `warnings: string[]` array, surfaced in the Data Quality Summary UI
- `parseDate()` handles 4 formats: ISO string, Excel serial number, DD/MM/YYYY, ISO 8601 timestamp
- DD/MM/YYYY disambiguation: cross-reference parsed date against neighboring records for the same ISIN. If the date would create a duplicate or fall outside the expected sequence, try MM/DD/YYYY. In this dataset, all 3 DD/MM/YYYY records have day > 12 in the second position, so ambiguity is unlikely — but the fallback logic should exist.

---

## 2. Optimization Algorithm

### Approach: Sharpe Heuristic with Recency-Aware Confidence

A simple risk-adjusted return heuristic. Each asset is scored by its Sharpe ratio, penalized by data confidence, then weights are allocated proportionally under constraints.

**Why not Mean-Variance Optimization (MVO)?** Given data quality issues and limited price history, a covariance matrix would be unreliable. A simpler model that is stable and explainable is more valuable than a complex one sensitive to noisy inputs. MVO is noted as a future improvement.

### Step 1: Calculate Monthly Returns

```
For each asset:
  Group daily prices by calendar month
  monthly_return = (last price of month / first price of month) - 1
```

Risk-free rate = 0 (not provided in dataset; does not affect relative ranking).

### Step 2: Calculate Sharpe Score

```
For each asset:
  mean_return = average of monthly returns
  volatility = standard deviation of monthly returns
  sharpe = mean_return / volatility
```

### Step 3: Recency-Aware Confidence Penalty

```
reference_window = last 12 months of the overall dataset
For each asset:
  recent_days = trading days in reference window with actual price data
  expected_days = trading days in reference window (from most complete asset)
  confidence = recent_days / expected_days
  adjustedScore = sharpe * confidence
```

Example:
- Normal assets: 12 months of recent data → confidence = 1.0
- Aegis Partners: only 6 of last 12 months → confidence ≈ 0.5
- adjustedScore = sharpe * 0.5 → naturally deprioritized

**Why recency-aware, not total coverage?** For a forward-looking recommendation, missing the most recent 6 months is far more damaging than missing 6 months from 2023. The confidence formula reflects this.

### Step 4: Select Top 5 Assets

```
1. Sort all assets by adjustedScore descending
2. Greedy selection with asset class cap check:
   - For each candidate, check if adding it would push its asset class total above 30%
   - If yes, skip to next candidate
   - Continue until 5 assets selected
```

### Step 5: Allocate Weights

```
1. raw_weight[i] = adjustedScore[i] / sum(all selected adjustedScores)
2. Apply constraints iteratively:
   a. Clip to [min_weight: 0.02, max_weight: 0.25]
   b. Check each asset class total ≤ 0.30
      - If exceeded: reduce the lowest-scored asset in that class until cap met
      - Redistribute freed weight proportionally to other classes
   c. Repeat until all constraints satisfied (max 10 iterations, then warn)
3. If total < 1.0: remainder → Cash
4. If total > 1.0: proportional reduction across all assets
```

### Step 6: Generate Explanations

For each asset, generate a human-readable explanation:
- Selected assets: why (Sharpe rank, adjusted score)
- Removed assets: why (low score, data confidence penalty, class cap conflict)

### Constraint Handling Summary

| Constraint | Treatment | Rationale |
|------------|-----------|-----------|
| `min_weight: 0.02` | Hard — assets below 2% are removed | Positions this small have no practical impact |
| `max_weight: 0.25` | Hard — clip at 25% | Prevents over-concentration |
| `asset_class_cap: 0.30` | Enforced during selection + allocation | Diversification requirement |
| `max_assets: 5` | Hard — select exactly 5 | Explicit constraint |
| Remaining weight | → Cash | Explicit representation |

---

## 3. UI / Visualization

Single-page application. No routing. Goal: explain the recommendation visually.

### Layout (top to bottom)

#### Header
"Portfolio Recommendation — Q2 2026"

#### Component 1: Data Quality Summary (collapsible)
- Default collapsed: "13 data issues detected and resolved"
- Expanded: list of each issue with how it was resolved
- Includes a **Constraint Compliance** row: confirms the recommendation satisfies max_assets, weight bounds, and asset class caps (or documents any soft violations)
- Purpose: shows the interviewer you found every trap, without cluttering the main view

#### Component 2: Weight Comparison Table (core deliverable)
```
Asset | Class | Current | Recommended | Change
NovaTech | Equity | 12% | 22% | +10% ▲
...
Cash | — | 2% | 8% | +6%
───
Removed:
Orion Hedge Fund | Alts | 8% | — | removed (low Sharpe)
```
- Green/red color coding for change direction
- Removed assets shown greyed out with removal reason
- Cash row always visible

#### Component 3: Sharpe Score Bar Chart (explains the recommendation)
- Horizontal bar chart ranking all assets by adjusted Sharpe score
- Cutoff line separating selected (top 5) from removed
- This chart directly answers "why these assets, why these weights"
- Client Component (interactive)

#### Component 4: Performance Chart (shows the outcome)
- Line chart: cumulative return over historical period
- Three lines: Current portfolio (grey), Recommended portfolio (green), Benchmark (blue dashed)
- Client Component (interactive)

#### Component 5: Risk Metrics Cards (if time permits)
- Current vs Recommended comparison
- Volatility, Sharpe Ratio, Max Drawdown
- Arrows + color for direction

#### Component 6: Recommendation Explanation
- 2-3 auto-generated bullet points from optimization results
- Example: "Overweighted NovaTech due to highest risk-adjusted return (Sharpe: 1.32)"

### Technical Choices

| Choice | Rationale |
|--------|-----------|
| Recharts or Chart.js | Lightweight, Next.js compatible |
| Tailwind CSS | Fast styling, no UI library overhead |
| Server Components for data | Processing server-side, no client-side CORS issues |
| Client Components only for charts | Minimize client JS bundle |
| Light theme with Antarctica navy accent (`#002D54`) | Professional, brand-aware without over-designing |
| Desktop-only | Sufficient for debrief; responsive is a nice-to-have |

---

## 4. Project Structure

```
portfolio-optimisation/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Main page (Server Component)
│   │   ├── layout.tsx            # Root layout
│   │   └── globals.css           # Tailwind styles
│   ├── lib/
│   │   ├── data/
│   │   │   ├── fetcher.ts        # Fetch raw JSON from S3
│   │   │   ├── schemas.ts        # Zod schemas (parse + validate)
│   │   │   ├── normalize.ts      # Business normalization
│   │   │   └── types.ts          # Domain types
│   │   └── optimization/
│   │       ├── returns.ts        # Daily → monthly returns
│   │       ├── sharpe.ts         # Sharpe score + confidence
│   │       ├── select.ts         # Asset selection (top 5 with caps)
│   │       └── allocate.ts       # Weight allocation + constraints
│   └── components/
│       ├── WeightTable.tsx
│       ├── SharpeChart.tsx       # Client Component
│       ├── PerformanceChart.tsx  # Client Component
│       ├── RiskCards.tsx         # If time permits
│       ├── DataQualitySummary.tsx
│       └── Explanation.tsx
├── docs/
│   └── data-exploration.md       # Stage 0: data quality findings + decisions (committed early)
├── CLAUDE.md                     # AI configuration (encouraged by brief)
└── README.md                     # Decisions, data issues, future work
```

File separation maps to the debrief narrative: each file has one clear responsibility.

---

## 5. Testing Strategy

Only test where bugs would be invisible:

| What | Why |
|------|-----|
| Data normalization (asset class mapping, ISIN dedup, date parsing) | Silent data corruption is the worst kind of bug |
| Sharpe calculation (known inputs → known outputs) | Math errors compound invisibly |
| Constraint enforcement (clip, cap, cash allocation) | Edge cases in constraint logic |

No UI tests — charts either render or they don't, verifiable visually.

**Debrief:** *"I tested the parts where bugs would be invisible — data cleaning and math. I didn't write UI tests because the chart either renders or it doesn't, and I can verify that visually."*

---

## 6. Commit Strategy

The brief says "We read commit history." Each commit tells a chapter of the engineering story. The sequence proves: **explore → decide → build → verify → ship.**

| Order | Commit Message | Demonstrates | Phase |
|-------|---------------|-------------|-------|
| 1 | `chore: project setup with Next.js, Tailwind, TypeScript` | Tool selection | Setup |
| 2 | `docs: data exploration log — document all quality issues and decisions` | **Analysis before code** | Stage 0 |
| 3 | `feat: data pipeline — fetch, parse, validate with Zod schemas` | Data engineering | Pipeline |
| 4 | `feat: data normalization — resolve 13 quality issues across all sources` | Rigor, thoroughness | Pipeline |
| 5 | `feat: optimization engine — sharpe scoring, recency confidence, asset selection` | Algorithm thinking | Algorithm |
| 6 | `feat: weight allocation with constraint enforcement` | Business logic | Algorithm |
| 7 | `feat: weight comparison table and sharpe score bar chart` | Frontend core | UI |
| 8 | `feat: performance chart with benchmark overlay and recommendation explanation` | Visual storytelling | UI |
| 9 | `feat: data quality summary and constraint compliance display` | Production-ready | UI |
| 10 | `chore: deploy to Vercel, finalize README with decisions and future work` | Delivery | Ship |

**Commit 2 is the differentiator.** Most candidates' first real commit is code. Ours is a decision document — proving we inspected the data before touching an editor.

---

## 7. Deployment

- Platform: Vercel (zero-config for Next.js)
- Data fetching: server-side at request time (S3 URLs are public)
- No environment variables needed
- Live URL shared with submission

---

## 8. Time Budget

| Phase | Time | Content | Commits |
|-------|------|---------|---------|
| Setup | ~10min | Next.js + Tailwind + project structure | #1 |
| Stage 0: Data Exploration | ~20min | Inspect data, write `data-exploration.md` | #2 |
| Data Pipeline | ~60min | Fetch + Zod + Normalize + all 13 data issues | #3, #4 |
| Optimization | ~60min | Returns + Sharpe + Confidence + Select + Allocate | #5, #6 |
| UI | ~80min | Table + 2 charts + Explanation + DataQuality | #7, #8, #9 |
| Polish | ~20min | README + Deploy | #10 |
| **Total** | **~4.5h** | | |

---

## 9. Debrief Preparation

### Key phrases to use

- *"UI never touches dirty data. All uncertainty is resolved or explicitly surfaced at the data layer."*
- *"I prefer explicit representation over implicit correction."* (re: Cash for unallocated weight)
- *"I treat constraints as soft and allow residual allocation to cash to maintain feasibility."*
- *"I optimise for robustness over statistical purity."*
- *"Rather than excluding assets with incomplete data, I apply a recency-aware confidence penalty. This way, the system degrades gracefully."*

### Expected questions and answers

**Q: Why not MVO?**
A: Given the data quality issues and time constraints, I prioritized robustness and interpretability. A simpler model that's stable and easy to reason about is more valuable than a complex one sensitive to noisy inputs.

**Q: Why not consider correlations?**
A: That's a good point. In a full portfolio optimisation, correlation would be important. However, given the data quality and time constraints, I prioritised a model I could fully explain and defend. MVO with a shrinkage estimator is where I'd go next.

**Q: How did you handle the benchmark URL?**
A: The URL in the brief uses eu-east-1, which isn't a valid AWS region. I noticed the other three files are all on eu-west-1, so I tried that and it worked. I documented this in the README and the Data Quality Summary.

**Q: Why Sharpe and not pure return maximization?**
A: The brief says "we optimise on monthly returns" which I interpreted as using monthly return data, not maximizing returns blindly. Pure return maximization ignores risk entirely — a 20% return with 50% volatility is worse than 15% return with 10% volatility. Sharpe captures this.

---

## 10. Future Improvements (for README "what I'd do next")

- Mean-Variance Optimization with shrinkage estimator for covariance
- Transaction cost / turnover penalty (penalize large changes from current weights)
- Benchmark tracking error as secondary objective
- Responsive design for mobile
- Historical weight recommendation backtesting
- Automated data quality monitoring / alerting
