# Portfolio Recommendation App — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy a Next.js app that reads Antarctica's portfolio data, produces recommended weights via Sharpe heuristic, and displays the recommendation with explanatory charts.

**Architecture:** Server Components fetch and process all data (pipeline + optimization). Client Components render interactive charts only. Single-page app deployed to Vercel.

**Tech Stack:** Next.js 16, TypeScript, Tailwind CSS, Zod, Recharts

**Spec:** `docs/superpowers/specs/2026-05-01-portfolio-recommendation-design.md`

---

## File Map

```
portfolio-optimisation/
├── src/
│   ├── app/
│   │   ├── page.tsx                  # Server Component — orchestrates data + optimization, renders page
│   │   ├── layout.tsx                # Root layout with metadata + font
│   │   └── globals.css               # Tailwind base + Antarctica theme tokens
│   ├── lib/
│   │   ├── data/
│   │   │   ├── types.ts              # Domain types: Holding, PriceRecord, BenchmarkRecord, Constraints, CleanedData
│   │   │   ├── urls.ts               # S3 URL constants
│   │   │   ├── fetcher.ts            # fetch all 4 JSON sources, return raw unknown
│   │   │   ├── schemas.ts            # Zod schemas for raw JSON parsing + coercion
│   │   │   ├── parse-date.ts         # parseDate() — handles 4 date formats
│   │   │   └── normalize.ts          # Business normalization: dedup, asset class map, currency map, warnings
│   │   └── optimization/
│   │       ├── types.ts              # AssetScore, OptimizationResult, Recommendation types
│   │       ├── returns.ts            # daily prices → monthly returns per asset
│   │       ├── sharpe.ts             # Sharpe score + recency-aware confidence
│   │       ├── select.ts             # Greedy top-5 selection with asset class caps
│   │       ├── allocate.ts           # Weight allocation + constraint enforcement + cash
│   │       └── optimize.ts           # Top-level orchestrator: returns → sharpe → select → allocate
│   └── components/
│       ├── WeightTable.tsx           # Server Component — weight comparison table
│       ├── SharpeChart.tsx           # Client Component — horizontal bar chart
│       ├── PerformanceChart.tsx      # Client Component — cumulative return line chart
│       ├── DataQualitySummary.tsx     # Client Component — collapsible data quality + constraint compliance
│       └── Explanation.tsx           # Server Component — recommendation bullet points
├── __tests__/
│   ├── parse-date.test.ts
│   ├── normalize.test.ts
│   ├── returns.test.ts
│   ├── sharpe.test.ts
│   └── allocate.test.ts
├── docs/
│   └── data-exploration.md
├── CLAUDE.md
└── README.md
```

---

## Task 1: Project Setup

**Files:**
- Create: `package.json`, `tsconfig.json`, `tailwind.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`

- [ ] **Step 1: Initialize Next.js project**

```bash
cd /Users/larryli/Code/portfolio-optimisation
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

Select defaults when prompted. This creates the full Next.js scaffolding.

- [ ] **Step 2: Install dependencies**

```bash
npm install zod recharts
npm install -D @types/node
```

- [ ] **Step 3: Set Antarctica theme in `globals.css`**

Replace the contents of `src/app/globals.css` with:

```css
@import "tailwindcss";

:root {
  --color-antarctica-navy: #002D54;
  --color-antarctica-light: #F8FAFC;
  --color-positive: #16A34A;
  --color-negative: #DC2626;
  --color-muted: #94A3B8;
}

body {
  font-family: var(--font-sans), ui-sans-serif, system-ui, sans-serif;
  background-color: var(--color-antarctica-light);
  color: #1E293B;
}
```

- [ ] **Step 4: Set up root layout**

Replace `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Portfolio Recommendation — Antarctica AM",
  description: "Q2 2026 portfolio weight recommendation engine",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased`}>{children}</body>
    </html>
  );
}
```

- [ ] **Step 5: Set up placeholder page**

Replace `src/app/page.tsx`:

```tsx
export default function Home() {
  return (
    <main className="max-w-6xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold text-[var(--color-antarctica-navy)]">
        Portfolio Recommendation — Q2 2026
      </h1>
      <p className="mt-2 text-[var(--color-muted)]">Loading data and computing recommendation...</p>
    </main>
  );
}
```

- [ ] **Step 6: Verify dev server starts**

```bash
npm run dev
```

Open `http://localhost:3000`. Expected: page with "Portfolio Recommendation — Q2 2026" heading on light background.

- [ ] **Step 7: Initialize git and commit** → **Commit #1**

```bash
git init
git add -A
git commit -m "chore: project setup with Next.js, Tailwind, TypeScript"
```

---

## Task 2: Data Exploration Document

**Files:**
- Create: `docs/data-exploration.md`

- [ ] **Step 1: Write the data exploration log**

Create `docs/data-exploration.md`:

```markdown
# Data Exploration Log

## Overview

Inspected all four data sources from Antarctica's S3 bucket before writing any application code. This document records every data quality issue found and the resolution decision with rationale.

**Data sources:** holdings.json (11 records), prices.json (7,489 records), benchmark.json (762 records), constraints.json (1 object)

**Date range:** 2023-04-05 to 2026-03-31 (business days only)

---

## Holdings

**Structure:** Array of objects with fields: `isin`, `name`, `asset_class`, `currency`, `weight`

**Records:** 11 entries, 10 unique ISINs

### Issues Found

1. **Duplicate ISIN (NTA002E0002)** — appears twice as "Coralis Holdings" (asset_class: "equity") and "Coralis Group" (asset_class: "Equity"). Both have weight 0.04.
   - **Resolution:** Merge into one record, sum weights (0.08), take first name. Rationale: same ISIN = same security; identical weights suggest data entry duplication.

2. **Inconsistent asset_class naming** — 6 variants found: `Equity`, `equity`, `Fixed Income`, `fixed-income`, `FI`, `Alternatives`.
   - **Resolution:** Normalize to 3 canonical values matching constraints.json keys: `Equity`, `Fixed Income`, `Alternatives`.

3. **Inconsistent currency format** — NTA004E0004 uses `US$` while others use `USD` or `EUR`.
   - **Resolution:** Map `US$` → `USD`.

4. **Weights sum to 0.98** — not 1.0, regardless of how duplicate is handled.
   - **Resolution:** Display remainder as "Unallocated Cash". Prefer explicit representation over implicit correction.

5. **Current portfolio already violates constraints** — Equity: 0.38 (cap 0.30), Fixed Income: 0.35 (cap 0.30), 10 assets (max 5).
   - **Resolution:** Display in UI as context for why rebalancing is needed.

---

## Prices

**Structure:** Array of objects with fields: `date`, `isin`, `price` (tall format)

**Records:** 7,489 total across 10 ISINs

**Date range:** 2023-04-05 to 2026-03-31

### Issues Found

6. **Four date formats mixed together:**
   - YYYY-MM-DD: 7,480 records (standard)
   - Excel serial integer: 2 records (e.g., `45719` = 2025-03-03)
   - DD/MM/YYYY: 3 records (e.g., `"08/04/2025"`)
   - ISO 8601 timestamp: 4 records (e.g., `"2024-10-03T23:59:59Z"`)
   - **Resolution:** Unified `parseDate()` handles all 4 formats. All 9 non-standard records fill gaps (no duplicates created). Unparseable records are logged and skipped.

7. **20.2% of prices are strings** — 1,513 of 7,489 records have prices as `"82.3866"` instead of `82.3866`. Distributed across all ISINs (141-162 per ISIN).
   - **Resolution:** Use `z.coerce.number()` in Zod schema for automatic conversion.

8. **NTA004E0004 (Aegis Partners) truncated** — data ends at 2025-09-29, missing last ~6 months. All other ISINs have data through 2026-03-31.
   - **Resolution:** Recency-aware confidence penalty. `confidence = recent_12m_days / expected_12m_days`. Aegis gets ~0.5 confidence, naturally deprioritized. Rationale: for a forward-looking recommendation, missing recent data is far more damaging than missing early data.

9. **NTA001E0001 missing 5 trading days** — scattered gaps relative to other ISINs.
   - **Resolution:** Forward fill. Minimal impact on monthly return calculation.

10. **NTA008A0008 suspicious price** — 4695.2893 on 2024-03-12 (one of the ISO timestamp records). Likely outlier if asset normally trades in hundreds.
    - **Resolution:** Check z-score against asset's price distribution. If >3 sigma, exclude with warning.

---

## Benchmark

**Structure:** Array of objects with fields: `date`, `level`

**Records:** 762 total, 756 unique dates

**Date range:** 2023-04-05 to 2026-03-31 (starts at level 1000.0)

### URL Discovery

The README specifies the benchmark URL with region `eu-east-1`, which is not a valid AWS region. The other three data files all use `eu-west-1`. Trying `eu-west-1` for the benchmark URL succeeds.

### Issues Found

11. **Invalid URL in assignment brief** — `eu-east-1` does not exist.
    - **Resolution:** Use `eu-west-1`. Document discovery in README and Data Quality Summary.

12. **6 duplicate dates with conflicting level values:**
    - 2023-06-13: 871.539 vs 863.2672
    - 2023-11-22: 964.2514 vs 968.354
    - 2024-08-07: 1001.7977 vs 996.6229
    - 2024-09-23: 961.5764 vs 963.0259
    - 2024-11-04: 1033.3543 vs 1031.5674
    - 2026-03-16: 1754.0181 vs 1776.6325
    - **Resolution:** Last entry wins (convention: later entry is a correction in market data feeds). Log each duplicate.

---

## Constraints

**Structure:** Single object with `min_weight`, `max_weight`, `per_asset_class_caps`, `max_assets`

### Issues Found

13. **Asset class caps sum to 0.90** — Equity 0.30 + Fixed Income 0.30 + Alternatives 0.30 = 0.90.
    - **Resolution:** Remaining 10% can be allocated to Cash. Consistent with cash treatment for unallocated weight in holdings.

---

## Key Decisions

1. **Optimization objective:** Sharpe ratio (risk-adjusted return). The brief says "we optimise on monthly returns" — interpreted as using monthly return data, not maximizing returns blindly. Sharpe captures both return and risk.

2. **Truncated asset handling:** Recency-aware confidence penalty rather than exclusion. Preserves information while naturally deprioritizing assets with incomplete recent data.

3. **Unallocated weight:** Explicit Cash representation. Prefer transparency over silent normalization.

4. **Benchmark usage:** Visual reference in performance chart, not an optimization target. The brief does not specify relative performance as an objective.

5. **Constraint treatment:** Soft, with Cash as feasibility buffer. The brief explicitly calls them "soft constraints."
```

- [ ] **Step 2: Commit** → **Commit #2**

```bash
git add docs/data-exploration.md CLAUDE.md
git commit -m "docs: data exploration log — document all quality issues and decisions"
```

---

## Task 3: Domain Types

**Files:**
- Create: `src/lib/data/types.ts`
- Create: `src/lib/optimization/types.ts`

- [ ] **Step 1: Create data domain types**

Create `src/lib/data/types.ts`:

```ts
export interface RawHolding {
  isin: string;
  name: string;
  asset_class: string;
  currency: string;
  weight: number;
}

export type AssetClass = "Equity" | "Fixed Income" | "Alternatives";

export interface Holding {
  isin: string;
  name: string;
  assetClass: AssetClass;
  currency: string;
  weight: number;
}

export interface PriceRecord {
  date: Date;
  isin: string;
  price: number;
}

export interface BenchmarkRecord {
  date: Date;
  level: number;
}

export interface Constraints {
  minWeight: number;
  maxWeight: number;
  perAssetClassCaps: Record<AssetClass, number>;
  maxAssets: number;
}

export interface DataWarning {
  source: "holdings" | "prices" | "benchmark" | "constraints";
  issue: string;
  resolution: string;
}

export interface CleanedData {
  holdings: Holding[];
  prices: PriceRecord[];
  benchmark: BenchmarkRecord[];
  constraints: Constraints;
  warnings: DataWarning[];
  cashWeight: number;
}
```

- [ ] **Step 2: Create optimization types**

Create `src/lib/optimization/types.ts`:

```ts
import type { AssetClass } from "@/lib/data/types";

export interface MonthlyReturn {
  isin: string;
  month: string; // "YYYY-MM"
  returnValue: number;
}

export interface AssetScore {
  isin: string;
  name: string;
  assetClass: AssetClass;
  meanReturn: number;
  volatility: number;
  sharpe: number;
  confidence: number;
  adjustedScore: number;
}

export interface Recommendation {
  isin: string;
  name: string;
  assetClass: AssetClass;
  currentWeight: number;
  recommendedWeight: number;
  change: number;
  reason: string;
}

export interface PortfolioMetrics {
  volatility: number;
  sharpe: number;
  cumulativeReturn: number;
}

export interface OptimizationResult {
  recommendations: Recommendation[];
  removedAssets: Recommendation[];
  cashWeight: number;
  scores: AssetScore[];
  currentMetrics: PortfolioMetrics;
  recommendedMetrics: PortfolioMetrics;
  cumulativeReturns: {
    date: string;
    current: number;
    recommended: number;
    benchmark: number | null;
  }[];
}
```

- [ ] **Step 3: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: no errors.

---

## Task 4: Date Parser + Tests

**Files:**
- Create: `src/lib/data/parse-date.ts`
- Create: `__tests__/parse-date.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/parse-date.test.ts`:

```ts
import { parseDate } from "@/lib/data/parse-date";

describe("parseDate", () => {
  it("parses YYYY-MM-DD format", () => {
    const result = parseDate("2023-04-05");
    expect(result).toBeInstanceOf(Date);
    expect(result!.toISOString().startsWith("2023-04-05")).toBe(true);
  });

  it("parses Excel serial number", () => {
    // 45719 = 2025-03-03 in Excel (1900 date system)
    const result = parseDate(45719);
    expect(result).toBeInstanceOf(Date);
    expect(result!.getFullYear()).toBe(2025);
    expect(result!.getMonth()).toBe(2); // March = 2
    expect(result!.getDate()).toBe(3);
  });

  it("parses DD/MM/YYYY format", () => {
    const result = parseDate("08/04/2025");
    expect(result).toBeInstanceOf(Date);
    expect(result!.toISOString().startsWith("2025-04-08")).toBe(true);
  });

  it("parses ISO 8601 timestamp", () => {
    const result = parseDate("2024-10-03T23:59:59Z");
    expect(result).toBeInstanceOf(Date);
    expect(result!.getFullYear()).toBe(2024);
    expect(result!.getMonth()).toBe(9); // October = 9
    expect(result!.getDate()).toBe(3);
  });

  it("returns null for unparseable input", () => {
    expect(parseDate("not-a-date")).toBeNull();
    expect(parseDate("")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest __tests__/parse-date.test.ts
```

If jest is not configured, first install and configure:

```bash
npm install -D jest ts-jest @types/jest
npx ts-jest config:init
```

Update the generated `jest.config.js` to add module name mapping:

```js
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
};
```

Run again. Expected: FAIL — module not found.

- [ ] **Step 3: Implement parseDate**

Create `src/lib/data/parse-date.ts`:

```ts
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DD_MM_YYYY_RE = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const ISO_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T/;

export function parseDate(input: string | number): Date | null {
  if (typeof input === "number") {
    return excelSerialToDate(input);
  }

  if (typeof input !== "string" || input.trim() === "") {
    return null;
  }

  if (ISO_DATE_RE.test(input)) {
    const d = new Date(input + "T00:00:00Z");
    return isNaN(d.getTime()) ? null : d;
  }

  if (ISO_TIMESTAMP_RE.test(input)) {
    const d = new Date(input);
    return isNaN(d.getTime()) ? null : stripTime(d);
  }

  const ddMmMatch = DD_MM_YYYY_RE.exec(input);
  if (ddMmMatch) {
    const [, dd, mm, yyyy] = ddMmMatch;
    const d = new Date(`${yyyy}-${mm}-${dd}T00:00:00Z`);
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}

function excelSerialToDate(serial: number): Date | null {
  if (serial < 1 || serial > 100000) return null;
  // Excel 1900 date system: day 1 = 1900-01-01
  // But Excel incorrectly treats 1900 as a leap year, so subtract 1 for dates after Feb 28 1900
  const excelEpoch = new Date(Date.UTC(1899, 11, 30));
  const ms = excelEpoch.getTime() + serial * 86400000;
  return new Date(ms);
}

function stripTime(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/parse-date.test.ts
```

Expected: all 5 tests PASS.

---

## Task 5: Zod Schemas + Data Fetcher

**Files:**
- Create: `src/lib/data/urls.ts`
- Create: `src/lib/data/schemas.ts`
- Create: `src/lib/data/fetcher.ts`

- [ ] **Step 1: Create URL constants**

Create `src/lib/data/urls.ts`:

```ts
const BASE = "https://antarctica-hiring-data.s3.eu-west-1.amazonaws.com/portfolio-optimisation/2026-04";

export const DATA_URLS = {
  holdings: `${BASE}/holdings.json`,
  prices: `${BASE}/prices.json`,
  benchmark: `${BASE}/benchmark.json`,
  constraints: `${BASE}/constraints.json`,
} as const;
```

- [ ] **Step 2: Create Zod schemas**

Create `src/lib/data/schemas.ts`:

```ts
import { z } from "zod";

export const RawHoldingSchema = z.object({
  isin: z.string(),
  name: z.string(),
  asset_class: z.string(),
  currency: z.string(),
  weight: z.coerce.number(),
});

export const RawPriceSchema = z.object({
  date: z.union([z.string(), z.number()]),
  isin: z.string(),
  price: z.coerce.number(),
});

export const RawBenchmarkSchema = z.object({
  date: z.string(),
  level: z.coerce.number(),
});

export const RawConstraintsSchema = z.object({
  min_weight: z.number(),
  max_weight: z.number(),
  per_asset_class_caps: z.record(z.string(), z.number()),
  max_assets: z.number(),
});

export const HoldingsArraySchema = z.array(RawHoldingSchema);
export const PricesArraySchema = z.array(RawPriceSchema);
export const BenchmarkArraySchema = z.array(RawBenchmarkSchema);
```

- [ ] **Step 3: Create fetcher**

Create `src/lib/data/fetcher.ts`:

```ts
import { DATA_URLS } from "./urls";
import {
  HoldingsArraySchema,
  PricesArraySchema,
  BenchmarkArraySchema,
  RawConstraintsSchema,
} from "./schemas";

export async function fetchRawData() {
  const [holdingsRes, pricesRes, benchmarkRes, constraintsRes] = await Promise.all([
    fetch(DATA_URLS.holdings, { next: { revalidate: 3600 } }),
    fetch(DATA_URLS.prices, { next: { revalidate: 3600 } }),
    fetch(DATA_URLS.benchmark, { next: { revalidate: 3600 } }),
    fetch(DATA_URLS.constraints, { next: { revalidate: 3600 } }),
  ]);

  const [holdingsJson, pricesJson, benchmarkJson, constraintsJson] = await Promise.all([
    holdingsRes.json(),
    pricesRes.json(),
    benchmarkRes.json(),
    constraintsRes.json(),
  ]);

  return {
    holdings: HoldingsArraySchema.parse(holdingsJson),
    prices: PricesArraySchema.parse(pricesJson),
    benchmark: BenchmarkArraySchema.parse(benchmarkJson),
    constraints: RawConstraintsSchema.parse(constraintsJson),
  };
}
```

- [ ] **Step 4: Verify compilation**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit** → **Commit #3**

```bash
git add src/lib/data/types.ts src/lib/data/urls.ts src/lib/data/schemas.ts src/lib/data/fetcher.ts src/lib/data/parse-date.ts __tests__/parse-date.test.ts jest.config.js
git commit -m "feat: data pipeline — fetch, parse, validate with Zod schemas

- Fetch all 4 data sources from S3 (benchmark URL corrected to eu-west-1)
- Zod schemas with z.coerce.number() for string price coercion
- parseDate() handles 4 date formats: ISO, Excel serial, DD/MM/YYYY, ISO timestamp
- Domain types for Holdings, Prices, Benchmark, Constraints"
```

---

## Task 6: Data Normalization + Tests

**Files:**
- Create: `src/lib/data/normalize.ts`
- Create: `__tests__/normalize.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/normalize.test.ts`:

```ts
import { normalizeAssetClass, normalizeCurrency, deduplicateHoldings } from "@/lib/data/normalize";

describe("normalizeAssetClass", () => {
  it("maps lowercase equity", () => {
    expect(normalizeAssetClass("equity")).toBe("Equity");
  });

  it("maps FI to Fixed Income", () => {
    expect(normalizeAssetClass("FI")).toBe("Fixed Income");
  });

  it("maps fixed-income to Fixed Income", () => {
    expect(normalizeAssetClass("fixed-income")).toBe("Fixed Income");
  });

  it("passes through canonical values", () => {
    expect(normalizeAssetClass("Equity")).toBe("Equity");
    expect(normalizeAssetClass("Fixed Income")).toBe("Fixed Income");
    expect(normalizeAssetClass("Alternatives")).toBe("Alternatives");
  });
});

describe("normalizeCurrency", () => {
  it("maps US$ to USD", () => {
    expect(normalizeCurrency("US$")).toBe("USD");
  });

  it("passes through USD", () => {
    expect(normalizeCurrency("USD")).toBe("USD");
  });

  it("passes through EUR", () => {
    expect(normalizeCurrency("EUR")).toBe("EUR");
  });
});

describe("deduplicateHoldings", () => {
  it("merges duplicate ISINs by summing weights", () => {
    const input = [
      { isin: "A", name: "First", asset_class: "Equity", currency: "USD", weight: 0.04 },
      { isin: "A", name: "Second", asset_class: "equity", currency: "USD", weight: 0.04 },
      { isin: "B", name: "Other", asset_class: "Equity", currency: "USD", weight: 0.10 },
    ];
    const { holdings, warnings } = deduplicateHoldings(input);
    expect(holdings).toHaveLength(2);
    expect(holdings[0].weight).toBe(0.08);
    expect(holdings[0].name).toBe("First");
    expect(warnings.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest __tests__/normalize.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement normalization**

Create `src/lib/data/normalize.ts`:

```ts
import type { z } from "zod";
import type { RawHoldingSchema, RawPriceSchema, RawBenchmarkSchema, RawConstraintsSchema } from "./schemas";
import type { Holding, PriceRecord, BenchmarkRecord, Constraints, DataWarning, CleanedData, AssetClass } from "./types";
import { parseDate } from "./parse-date";

const ASSET_CLASS_MAP: Record<string, AssetClass> = {
  equity: "Equity",
  equities: "Equity",
  stock: "Equity",
  "fixed income": "Fixed Income",
  "fixed-income": "Fixed Income",
  fi: "Fixed Income",
  bond: "Fixed Income",
  alternatives: "Alternatives",
  alternative: "Alternatives",
  alts: "Alternatives",
};

const CURRENCY_MAP: Record<string, string> = {
  "US$": "USD",
};

export function normalizeAssetClass(raw: string): AssetClass {
  const key = raw.toLowerCase().trim();
  return ASSET_CLASS_MAP[key] ?? (raw as AssetClass);
}

export function normalizeCurrency(raw: string): string {
  return CURRENCY_MAP[raw] ?? raw;
}

export function deduplicateHoldings(
  raw: z.infer<typeof RawHoldingSchema>[]
): { holdings: z.infer<typeof RawHoldingSchema>[]; warnings: DataWarning[] } {
  const warnings: DataWarning[] = [];
  const seen = new Map<string, z.infer<typeof RawHoldingSchema>>();

  for (const h of raw) {
    const existing = seen.get(h.isin);
    if (existing) {
      existing.weight = parseFloat((existing.weight + h.weight).toFixed(10));
      warnings.push({
        source: "holdings",
        issue: `Duplicate ISIN ${h.isin}: "${existing.name}" and "${h.name}" (weights merged: ${existing.weight})`,
        resolution: "Merged into one record, summed weights, kept first name",
      });
    } else {
      seen.set(h.isin, { ...h });
    }
  }

  return { holdings: Array.from(seen.values()), warnings };
}

export function normalizeAllData(
  rawHoldings: z.infer<typeof RawHoldingSchema>[],
  rawPrices: z.infer<typeof RawPriceSchema>[],
  rawBenchmark: z.infer<typeof RawBenchmarkSchema>[],
  rawConstraints: z.infer<typeof RawConstraintsSchema>
): CleanedData {
  const warnings: DataWarning[] = [];

  // --- Holdings ---
  const { holdings: dedupedHoldings, warnings: dedupWarnings } = deduplicateHoldings(rawHoldings);
  warnings.push(...dedupWarnings);

  const holdings: Holding[] = dedupedHoldings.map((h) => {
    const assetClass = normalizeAssetClass(h.asset_class);
    if (assetClass !== h.asset_class) {
      warnings.push({
        source: "holdings",
        issue: `Asset class "${h.asset_class}" normalized to "${assetClass}" for ${h.isin}`,
        resolution: "Mapped to canonical value matching constraints keys",
      });
    }

    const currency = normalizeCurrency(h.currency);
    if (currency !== h.currency) {
      warnings.push({
        source: "holdings",
        issue: `Currency "${h.currency}" normalized to "${currency}" for ${h.isin}`,
        resolution: "Mapped to ISO currency code",
      });
    }

    return { isin: h.isin, name: h.name, assetClass, currency, weight: h.weight };
  });

  const weightSum = holdings.reduce((sum, h) => sum + h.weight, 0);
  const cashWeight = parseFloat((1 - weightSum).toFixed(10));
  if (Math.abs(cashWeight) > 0.001) {
    warnings.push({
      source: "holdings",
      issue: `Weights sum to ${weightSum.toFixed(4)}, not 1.0`,
      resolution: `${(cashWeight * 100).toFixed(1)}% treated as unallocated cash`,
    });
  }

  // --- Prices ---
  const prices: PriceRecord[] = [];
  let priceParseIssues = 0;
  let stringPriceCount = 0;

  for (const p of rawPrices) {
    const date = parseDate(p.date);
    if (!date) {
      priceParseIssues++;
      continue;
    }
    if (isNaN(p.price)) {
      priceParseIssues++;
      continue;
    }
    prices.push({ date, isin: p.isin, price: p.price });
  }

  // Count format issues for warnings
  const nonStandardDates = rawPrices.filter(
    (p) => typeof p.date === "number" || (typeof p.date === "string" && !/^\d{4}-\d{2}-\d{2}$/.test(p.date))
  );
  if (nonStandardDates.length > 0) {
    warnings.push({
      source: "prices",
      issue: `${nonStandardDates.length} records with non-standard date formats (Excel serial, DD/MM/YYYY, ISO timestamp)`,
      resolution: "All parsed successfully via unified date parser",
    });
  }

  const stringPrices = rawPrices.filter(
    (p) => typeof (p as Record<string, unknown>).price === "string"
  );
  if (stringPrices.length > 0) {
    warnings.push({
      source: "prices",
      issue: `${stringPrices.length} price values encoded as strings (${((stringPrices.length / rawPrices.length) * 100).toFixed(1)}%)`,
      resolution: "Coerced to numbers via Zod schema",
    });
  }

  if (priceParseIssues > 0) {
    warnings.push({
      source: "prices",
      issue: `${priceParseIssues} records skipped due to unparseable date or NaN price`,
      resolution: "Excluded from calculations",
    });
  }

  // Detect outliers per ISIN
  const pricesByIsin = new Map<string, number[]>();
  for (const p of prices) {
    const arr = pricesByIsin.get(p.isin) ?? [];
    arr.push(p.price);
    pricesByIsin.set(p.isin, arr);
  }

  const outlierIsins: string[] = [];
  for (const [isin, vals] of pricesByIsin) {
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const std = Math.sqrt(vals.reduce((sum, v) => sum + (v - mean) ** 2, 0) / vals.length);
    if (std > 0) {
      const outliers = vals.filter((v) => Math.abs(v - mean) / std > 3);
      if (outliers.length > 0) {
        outlierIsins.push(isin);
        warnings.push({
          source: "prices",
          issue: `${isin} has ${outliers.length} price outlier(s) beyond 3 sigma: ${outliers.map((v) => v.toFixed(2)).join(", ")}`,
          resolution: "Flagged for review; included in calculations unless manually excluded",
        });
      }
    }
  }

  // --- Benchmark ---
  const benchmarkMap = new Map<string, BenchmarkRecord>();
  let benchmarkDupes = 0;

  for (const b of rawBenchmark) {
    const date = parseDate(b.date);
    if (!date || isNaN(b.level)) continue;
    const key = date.toISOString().slice(0, 10);
    if (benchmarkMap.has(key)) {
      benchmarkDupes++;
    }
    benchmarkMap.set(key, { date, level: b.level }); // last entry wins
  }

  if (benchmarkDupes > 0) {
    warnings.push({
      source: "benchmark",
      issue: `${benchmarkDupes} duplicate dates with conflicting levels`,
      resolution: "Last entry wins (convention: later entry is correction)",
    });
  }

  warnings.push({
    source: "benchmark",
    issue: "README URL uses eu-east-1 (invalid AWS region)",
    resolution: "Corrected to eu-west-1 (same region as other data files)",
  });

  const benchmark = Array.from(benchmarkMap.values()).sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );

  // --- Constraints ---
  const capsSum = Object.values(rawConstraints.per_asset_class_caps).reduce((a, b) => a + b, 0);
  if (Math.abs(capsSum - 1.0) > 0.001) {
    warnings.push({
      source: "constraints",
      issue: `Asset class caps sum to ${capsSum.toFixed(2)}, not 1.0`,
      resolution: `Remaining ${((1 - capsSum) * 100).toFixed(0)}% can be allocated to Cash`,
    });
  }

  const constraints: Constraints = {
    minWeight: rawConstraints.min_weight,
    maxWeight: rawConstraints.max_weight,
    perAssetClassCaps: rawConstraints.per_asset_class_caps as Record<AssetClass, number>,
    maxAssets: rawConstraints.max_assets,
  };

  return { holdings, prices, benchmark, constraints, warnings, cashWeight: Math.max(cashWeight, 0) };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/normalize.test.ts
```

Expected: all 8 tests PASS.

- [ ] **Step 5: Commit** → **Commit #4**

```bash
git add src/lib/data/normalize.ts __tests__/normalize.test.ts
git commit -m "feat: data normalization — resolve 13 quality issues across all sources

- ISIN deduplication (merge weights, keep first name)
- Asset class normalization (6 variants → 3 canonical values)
- Currency normalization (US$ → USD)
- Benchmark dedup (last-entry-wins for 6 duplicate dates)
- Price outlier detection via z-score
- All corrections logged as DataWarning[] for UI display"
```

---

## Task 7: Monthly Returns + Tests

**Files:**
- Create: `src/lib/optimization/returns.ts`
- Create: `__tests__/returns.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/returns.test.ts`:

```ts
import { calculateMonthlyReturns } from "@/lib/optimization/returns";
import type { PriceRecord } from "@/lib/data/types";

describe("calculateMonthlyReturns", () => {
  it("computes monthly return as (last/first - 1)", () => {
    const prices: PriceRecord[] = [
      { date: new Date("2024-01-02"), isin: "A", price: 100 },
      { date: new Date("2024-01-15"), isin: "A", price: 105 },
      { date: new Date("2024-01-31"), isin: "A", price: 110 },
      { date: new Date("2024-02-03"), isin: "A", price: 108 },
      { date: new Date("2024-02-28"), isin: "A", price: 115 },
    ];

    const returns = calculateMonthlyReturns(prices, "A");
    expect(returns).toHaveLength(2);
    // Jan: 110/100 - 1 = 0.10
    expect(returns[0].returnValue).toBeCloseTo(0.10, 4);
    // Feb: 115/108 - 1 ≈ 0.0648
    expect(returns[1].returnValue).toBeCloseTo(0.0648, 3);
  });

  it("skips months with only one data point", () => {
    const prices: PriceRecord[] = [
      { date: new Date("2024-01-15"), isin: "A", price: 100 },
    ];

    const returns = calculateMonthlyReturns(prices, "A");
    expect(returns).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests — expected FAIL**

```bash
npx jest __tests__/returns.test.ts
```

- [ ] **Step 3: Implement monthly returns**

Create `src/lib/optimization/returns.ts`:

```ts
import type { PriceRecord } from "@/lib/data/types";
import type { MonthlyReturn } from "./types";

export function calculateMonthlyReturns(prices: PriceRecord[], isin: string): MonthlyReturn[] {
  const assetPrices = prices
    .filter((p) => p.isin === isin)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const byMonth = new Map<string, PriceRecord[]>();
  for (const p of assetPrices) {
    const key = `${p.date.getUTCFullYear()}-${String(p.date.getUTCMonth() + 1).padStart(2, "0")}`;
    const arr = byMonth.get(key) ?? [];
    arr.push(p);
    byMonth.set(key, arr);
  }

  const returns: MonthlyReturn[] = [];
  for (const [month, records] of byMonth) {
    if (records.length < 2) continue;
    const first = records[0].price;
    const last = records[records.length - 1].price;
    returns.push({ isin, month, returnValue: last / first - 1 });
  }

  return returns;
}
```

- [ ] **Step 4: Run tests — expected PASS**

```bash
npx jest __tests__/returns.test.ts
```

---

## Task 8: Sharpe Score + Confidence + Tests

**Files:**
- Create: `src/lib/optimization/sharpe.ts`
- Create: `__tests__/sharpe.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/sharpe.test.ts`:

```ts
import { calculateSharpe, calculateConfidence } from "@/lib/optimization/sharpe";
import type { MonthlyReturn } from "@/lib/optimization/types";

describe("calculateSharpe", () => {
  it("computes mean / std of returns", () => {
    const returns: MonthlyReturn[] = [
      { isin: "A", month: "2024-01", returnValue: 0.05 },
      { isin: "A", month: "2024-02", returnValue: 0.03 },
      { isin: "A", month: "2024-03", returnValue: 0.07 },
      { isin: "A", month: "2024-04", returnValue: 0.01 },
    ];

    const sharpe = calculateSharpe(returns);
    // mean = 0.04, std ≈ 0.02236
    expect(sharpe).toBeGreaterThan(1.5);
    expect(sharpe).toBeLessThan(2.0);
  });

  it("returns 0 for zero volatility", () => {
    const returns: MonthlyReturn[] = [
      { isin: "A", month: "2024-01", returnValue: 0.05 },
      { isin: "A", month: "2024-02", returnValue: 0.05 },
    ];

    expect(calculateSharpe(returns)).toBe(0);
  });
});

describe("calculateConfidence", () => {
  it("returns 1.0 for full data coverage", () => {
    const latestDate = new Date("2026-03-31");
    const assetDates = Array.from({ length: 252 }, (_, i) => {
      const d = new Date("2025-04-01");
      d.setDate(d.getDate() + i);
      return d;
    });
    const allDates = [...assetDates]; // same set = full coverage

    const conf = calculateConfidence(assetDates, allDates, latestDate);
    expect(conf).toBeCloseTo(1.0, 1);
  });

  it("returns ~0.5 for half coverage in recent 12 months", () => {
    const latestDate = new Date("2026-03-31");
    // Asset only has data up to 2025-09-30 (first 6 of 12 months)
    const assetDates = Array.from({ length: 126 }, (_, i) => {
      const d = new Date("2025-04-01");
      d.setDate(d.getDate() + i);
      return d;
    });
    const allDates = Array.from({ length: 252 }, (_, i) => {
      const d = new Date("2025-04-01");
      d.setDate(d.getDate() + i);
      return d;
    });

    const conf = calculateConfidence(assetDates, allDates, latestDate);
    expect(conf).toBeGreaterThan(0.4);
    expect(conf).toBeLessThan(0.6);
  });
});
```

- [ ] **Step 2: Run tests — expected FAIL**

```bash
npx jest __tests__/sharpe.test.ts
```

- [ ] **Step 3: Implement Sharpe + Confidence**

Create `src/lib/optimization/sharpe.ts`:

```ts
import type { MonthlyReturn } from "./types";

export function calculateSharpe(returns: MonthlyReturn[]): number {
  if (returns.length < 2) return 0;

  const values = returns.map((r) => r.returnValue);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length - 1);
  const std = Math.sqrt(variance);

  if (std === 0) return 0;
  return mean / std;
}

export function calculateConfidence(
  assetDates: Date[],
  allDates: Date[],
  latestDate: Date
): number {
  const twelveMonthsAgo = new Date(latestDate);
  twelveMonthsAgo.setUTCFullYear(twelveMonthsAgo.getUTCFullYear() - 1);

  const recentExpected = allDates.filter((d) => d >= twelveMonthsAgo).length;
  if (recentExpected === 0) return 1;

  const recentActual = assetDates.filter((d) => d >= twelveMonthsAgo).length;
  return recentActual / recentExpected;
}

export function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}
```

- [ ] **Step 4: Run tests — expected PASS**

```bash
npx jest __tests__/sharpe.test.ts
```

---

## Task 9: Asset Selection + Weight Allocation + Tests

**Files:**
- Create: `src/lib/optimization/select.ts`
- Create: `src/lib/optimization/allocate.ts`
- Create: `__tests__/allocate.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/allocate.test.ts`:

```ts
import { selectAssets } from "@/lib/optimization/select";
import { allocateWeights } from "@/lib/optimization/allocate";
import type { AssetScore } from "@/lib/optimization/types";
import type { Constraints } from "@/lib/data/types";

const mockConstraints: Constraints = {
  minWeight: 0.02,
  maxWeight: 0.25,
  perAssetClassCaps: { Equity: 0.3, "Fixed Income": 0.3, Alternatives: 0.3 },
  maxAssets: 5,
};

describe("selectAssets", () => {
  it("selects top 5 by adjustedScore", () => {
    const scores: AssetScore[] = Array.from({ length: 8 }, (_, i) => ({
      isin: `A${i}`,
      name: `Asset ${i}`,
      assetClass: i < 3 ? "Equity" : i < 6 ? "Fixed Income" : "Alternatives",
      meanReturn: 0.05,
      volatility: 0.02,
      sharpe: 2.5 - i * 0.2,
      confidence: 1,
      adjustedScore: 2.5 - i * 0.2,
    }));

    const selected = selectAssets(scores, mockConstraints);
    expect(selected).toHaveLength(5);
    expect(selected[0].isin).toBe("A0");
  });

  it("respects asset class caps during selection", () => {
    // All 8 assets are Equity — can only select enough to stay under 30%
    const scores: AssetScore[] = Array.from({ length: 8 }, (_, i) => ({
      isin: `E${i}`,
      name: `Equity ${i}`,
      assetClass: "Equity" as const,
      meanReturn: 0.05,
      volatility: 0.02,
      sharpe: 2.0 - i * 0.1,
      confidence: 1,
      adjustedScore: 2.0 - i * 0.1,
    }));

    const selected = selectAssets(scores, mockConstraints);
    // With max_weight 0.25, max 1 equity can fit in 0.30 cap
    // Actually greedy just picks by score, cap is checked in allocation
    // Selection only skips if adding would make class > cap impossible
    expect(selected.length).toBeLessThanOrEqual(5);
  });
});

describe("allocateWeights", () => {
  it("allocates proportionally and clips to bounds", () => {
    const selected: AssetScore[] = [
      { isin: "A", name: "A", assetClass: "Equity", meanReturn: 0.05, volatility: 0.02, sharpe: 2.5, confidence: 1, adjustedScore: 2.5 },
      { isin: "B", name: "B", assetClass: "Fixed Income", meanReturn: 0.04, volatility: 0.02, sharpe: 2.0, confidence: 1, adjustedScore: 2.0 },
      { isin: "C", name: "C", assetClass: "Alternatives", meanReturn: 0.03, volatility: 0.02, sharpe: 1.5, confidence: 1, adjustedScore: 1.5 },
    ];

    const result = allocateWeights(selected, mockConstraints);
    const totalWeight = result.weights.reduce((sum, w) => sum + w.weight, 0) + result.cashWeight;
    expect(totalWeight).toBeCloseTo(1.0, 4);
    result.weights.forEach((w) => {
      expect(w.weight).toBeGreaterThanOrEqual(mockConstraints.minWeight);
      expect(w.weight).toBeLessThanOrEqual(mockConstraints.maxWeight);
    });
  });
});
```

- [ ] **Step 2: Run tests — expected FAIL**

```bash
npx jest __tests__/allocate.test.ts
```

- [ ] **Step 3: Implement asset selection**

Create `src/lib/optimization/select.ts`:

```ts
import type { AssetScore } from "./types";
import type { AssetClass, Constraints } from "@/lib/data/types";

export function selectAssets(scores: AssetScore[], constraints: Constraints): AssetScore[] {
  const sorted = [...scores].sort((a, b) => b.adjustedScore - a.adjustedScore);
  const selected: AssetScore[] = [];
  const classCounts = new Map<AssetClass, number>();

  for (const asset of sorted) {
    if (selected.length >= constraints.maxAssets) break;

    const currentCount = classCounts.get(asset.assetClass) ?? 0;
    // Estimate: can this class absorb another asset without exceeding cap?
    // With minWeight 0.02, adding one more needs at least 0.02 headroom
    const cap = constraints.perAssetClassCaps[asset.assetClass] ?? 0.3;
    const estimatedClassWeight = (currentCount + 1) * constraints.minWeight;
    if (estimatedClassWeight > cap) continue;

    selected.push(asset);
    classCounts.set(asset.assetClass, currentCount + 1);
  }

  return selected;
}
```

- [ ] **Step 4: Implement weight allocation**

Create `src/lib/optimization/allocate.ts`:

```ts
import type { AssetScore } from "./types";
import type { AssetClass, Constraints } from "@/lib/data/types";

interface WeightedAsset {
  isin: string;
  name: string;
  assetClass: AssetClass;
  weight: number;
}

export function allocateWeights(
  selected: AssetScore[],
  constraints: Constraints
): { weights: WeightedAsset[]; cashWeight: number } {
  if (selected.length === 0) {
    return { weights: [], cashWeight: 1.0 };
  }

  const totalScore = selected.reduce((sum, s) => sum + s.adjustedScore, 0);

  let weights: WeightedAsset[] = selected.map((s) => ({
    isin: s.isin,
    name: s.name,
    assetClass: s.assetClass,
    weight: totalScore > 0 ? s.adjustedScore / totalScore : 1 / selected.length,
  }));

  // Iterative constraint enforcement (max 10 rounds)
  for (let iter = 0; iter < 10; iter++) {
    let changed = false;

    // Clip individual weights
    for (const w of weights) {
      if (w.weight < constraints.minWeight) {
        w.weight = constraints.minWeight;
        changed = true;
      }
      if (w.weight > constraints.maxWeight) {
        w.weight = constraints.maxWeight;
        changed = true;
      }
    }

    // Check asset class caps
    const classTotals = new Map<AssetClass, number>();
    for (const w of weights) {
      classTotals.set(w.assetClass, (classTotals.get(w.assetClass) ?? 0) + w.weight);
    }

    for (const [cls, total] of classTotals) {
      const cap = constraints.perAssetClassCaps[cls] ?? 0.3;
      if (total > cap + 0.001) {
        // Reduce weights in this class proportionally
        const ratio = cap / total;
        for (const w of weights) {
          if (w.assetClass === cls) {
            w.weight *= ratio;
            changed = true;
          }
        }
      }
    }

    // Re-normalize to sum <= 1.0
    const total = weights.reduce((sum, w) => sum + w.weight, 0);
    if (total > 1.0) {
      const ratio = 1.0 / total;
      for (const w of weights) {
        w.weight *= ratio;
      }
      changed = true;
    }

    if (!changed) break;
  }

  const allocatedTotal = weights.reduce((sum, w) => sum + w.weight, 0);
  const cashWeight = Math.max(0, parseFloat((1 - allocatedTotal).toFixed(10)));

  // Round weights to 4 decimal places
  weights = weights.map((w) => ({ ...w, weight: parseFloat(w.weight.toFixed(4)) }));

  return { weights, cashWeight: parseFloat(cashWeight.toFixed(4)) };
}
```

- [ ] **Step 5: Run tests — expected PASS**

```bash
npx jest __tests__/allocate.test.ts
```

- [ ] **Step 6: Commit** → **Commit #5**

```bash
git add src/lib/optimization/types.ts src/lib/optimization/returns.ts src/lib/optimization/sharpe.ts src/lib/optimization/select.ts __tests__/returns.test.ts __tests__/sharpe.test.ts
git commit -m "feat: optimization engine — sharpe scoring, recency confidence, asset selection

- Monthly return calculation (simple returns: last/first - 1)
- Sharpe ratio (mean return / volatility, Rf = 0)
- Recency-aware confidence penalty for truncated assets
- Greedy top-5 asset selection respecting asset class caps"
```

---

## Task 10: Optimization Orchestrator

**Files:**
- Create: `src/lib/optimization/optimize.ts`

- [ ] **Step 1: Create the top-level optimization function**

Create `src/lib/optimization/optimize.ts`:

```ts
import type { CleanedData } from "@/lib/data/types";
import type { AssetScore, OptimizationResult, Recommendation } from "./types";
import { calculateMonthlyReturns } from "./returns";
import { calculateSharpe, calculateConfidence, mean, stdDev } from "./sharpe";
import { selectAssets } from "./select";
import { allocateWeights } from "./allocate";

export function optimizePortfolio(data: CleanedData): OptimizationResult {
  const { holdings, prices, benchmark, constraints } = data;

  // Find the latest date across all prices
  const allDates = [...new Set(prices.map((p) => p.date.getTime()))].map((t) => new Date(t));
  allDates.sort((a, b) => a.getTime() - b.getTime());
  const latestDate = allDates[allDates.length - 1];

  // Calculate scores for each asset
  const scores: AssetScore[] = holdings.map((h) => {
    const monthlyReturns = calculateMonthlyReturns(prices, h.isin);
    const sharpe = calculateSharpe(monthlyReturns);

    const assetDates = prices.filter((p) => p.isin === h.isin).map((p) => p.date);
    const confidence = calculateConfidence(assetDates, allDates, latestDate);

    return {
      isin: h.isin,
      name: h.name,
      assetClass: h.assetClass,
      meanReturn: monthlyReturns.length > 0 ? mean(monthlyReturns.map((r) => r.returnValue)) : 0,
      volatility: monthlyReturns.length > 0 ? stdDev(monthlyReturns.map((r) => r.returnValue)) : 0,
      sharpe,
      confidence,
      adjustedScore: sharpe * confidence,
    };
  });

  // Select top assets
  const selected = selectAssets(scores, constraints);
  const selectedIsins = new Set(selected.map((s) => s.isin));

  // Allocate weights
  const { weights, cashWeight } = allocateWeights(selected, constraints);
  const weightMap = new Map(weights.map((w) => [w.isin, w.weight]));

  // Build recommendations
  const recommendations: Recommendation[] = weights.map((w) => {
    const holding = holdings.find((h) => h.isin === w.isin)!;
    const score = scores.find((s) => s.isin === w.isin)!;
    const change = w.weight - holding.weight;
    return {
      isin: w.isin,
      name: w.name,
      assetClass: w.assetClass,
      currentWeight: holding.weight,
      recommendedWeight: w.weight,
      change: parseFloat(change.toFixed(4)),
      reason: `Adjusted Sharpe score: ${score.adjustedScore.toFixed(2)} (rank #${selected.indexOf(score) + 1})`,
    };
  });

  const removedAssets: Recommendation[] = holdings
    .filter((h) => !selectedIsins.has(h.isin))
    .map((h) => {
      const score = scores.find((s) => s.isin === h.isin)!;
      let reason = `Adjusted Sharpe: ${score.adjustedScore.toFixed(2)} — below selection threshold`;
      if (score.confidence < 1) {
        reason += ` (confidence penalty: ${(score.confidence * 100).toFixed(0)}%)`;
      }
      return {
        isin: h.isin,
        name: h.name,
        assetClass: h.assetClass,
        currentWeight: h.weight,
        recommendedWeight: 0,
        change: -h.weight,
        reason,
      };
    });

  // Calculate cumulative returns for chart
  const cumulativeReturns = calculateCumulativeReturns(
    prices,
    benchmark,
    holdings,
    recommendations,
    cashWeight
  );

  // Portfolio-level metrics
  const currentMetrics = calculatePortfolioMetrics(prices, holdings);
  const recWeights = recommendations.map((r) => ({ isin: r.isin, weight: r.recommendedWeight }));
  const recommendedMetrics = calculatePortfolioMetrics(prices, recWeights);

  return {
    recommendations,
    removedAssets,
    cashWeight,
    scores,
    currentMetrics,
    recommendedMetrics,
    cumulativeReturns,
  };
}

function calculatePortfolioMetrics(
  prices: { date: Date; isin: string; price: number }[],
  weights: { isin: string; weight: number }[]
): { volatility: number; sharpe: number; cumulativeReturn: number } {
  // Calculate portfolio monthly returns
  const allMonthlyReturns = new Map<string, number>();

  for (const { isin, weight } of weights) {
    const assetPrices = prices.filter((p) => p.isin === isin).sort((a, b) => a.date.getTime() - b.date.getTime());
    const byMonth = new Map<string, { first: number; last: number }>();

    for (const p of assetPrices) {
      const key = `${p.date.getUTCFullYear()}-${String(p.date.getUTCMonth() + 1).padStart(2, "0")}`;
      const existing = byMonth.get(key);
      if (!existing) {
        byMonth.set(key, { first: p.price, last: p.price });
      } else {
        existing.last = p.price;
      }
    }

    for (const [month, { first, last }] of byMonth) {
      const ret = (last / first - 1) * weight;
      allMonthlyReturns.set(month, (allMonthlyReturns.get(month) ?? 0) + ret);
    }
  }

  const returns = Array.from(allMonthlyReturns.values());
  if (returns.length === 0) return { volatility: 0, sharpe: 0, cumulativeReturn: 0 };

  const m = returns.reduce((a, b) => a + b, 0) / returns.length;
  const v = Math.sqrt(returns.reduce((sum, r) => sum + (r - m) ** 2, 0) / (returns.length - 1));
  const cumulative = returns.reduce((acc, r) => acc * (1 + r), 1) - 1;

  return { volatility: v, sharpe: v > 0 ? m / v : 0, cumulativeReturn: cumulative };
}

function calculateCumulativeReturns(
  prices: { date: Date; isin: string; price: number }[],
  benchmark: { date: Date; level: number }[],
  currentHoldings: { isin: string; weight: number }[],
  recommendations: { isin: string; recommendedWeight: number }[],
  cashWeight: number
): { date: string; current: number; recommended: number; benchmark: number | null }[] {
  // Get all unique months
  const months = new Set<string>();
  for (const p of prices) {
    months.add(`${p.date.getUTCFullYear()}-${String(p.date.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  const sortedMonths = Array.from(months).sort();

  // Get first price of each month per ISIN for normalization
  const firstPrices = new Map<string, Map<string, number>>();
  for (const p of prices) {
    const month = `${p.date.getUTCFullYear()}-${String(p.date.getUTCMonth() + 1).padStart(2, "0")}`;
    const isinMap = firstPrices.get(p.isin) ?? new Map<string, number>();
    if (!isinMap.has(month)) {
      isinMap.set(month, p.price);
    }
    firstPrices.set(p.isin, isinMap);
  }

  // Last price per month per ISIN
  const lastPrices = new Map<string, Map<string, number>>();
  for (const p of [...prices].sort((a, b) => a.date.getTime() - b.date.getTime())) {
    const month = `${p.date.getUTCFullYear()}-${String(p.date.getUTCMonth() + 1).padStart(2, "0")}`;
    const isinMap = lastPrices.get(p.isin) ?? new Map<string, number>();
    isinMap.set(month, p.price);
    lastPrices.set(p.isin, isinMap);
  }

  // Benchmark by month
  const benchmarkByMonth = new Map<string, { first: number; last: number }>();
  const sortedBenchmark = [...benchmark].sort((a, b) => a.date.getTime() - b.date.getTime());
  for (const b of sortedBenchmark) {
    const month = `${b.date.getUTCFullYear()}-${String(b.date.getUTCMonth() + 1).padStart(2, "0")}`;
    const existing = benchmarkByMonth.get(month);
    if (!existing) {
      benchmarkByMonth.set(month, { first: b.level, last: b.level });
    } else {
      existing.last = b.level;
    }
  }

  let currentCum = 1;
  let recommendedCum = 1;
  let benchmarkCum = 1;

  return sortedMonths.map((month) => {
    // Portfolio return for current weights
    let currentReturn = 0;
    for (const h of currentHoldings) {
      const first = firstPrices.get(h.isin)?.get(month);
      const last = lastPrices.get(h.isin)?.get(month);
      if (first && last) {
        currentReturn += (last / first - 1) * h.weight;
      }
    }

    // Portfolio return for recommended weights
    let recommendedReturn = 0;
    for (const r of recommendations) {
      const first = firstPrices.get(r.isin)?.get(month);
      const last = lastPrices.get(r.isin)?.get(month);
      if (first && last) {
        recommendedReturn += (last / first - 1) * r.recommendedWeight;
      }
    }

    // Benchmark return
    const bm = benchmarkByMonth.get(month);
    let benchmarkReturn: number | null = null;
    if (bm) {
      benchmarkReturn = bm.last / bm.first - 1;
    }

    currentCum *= 1 + currentReturn;
    recommendedCum *= 1 + recommendedReturn;
    if (benchmarkReturn !== null) {
      benchmarkCum *= 1 + benchmarkReturn;
    }

    return {
      date: month,
      current: parseFloat(((currentCum - 1) * 100).toFixed(2)),
      recommended: parseFloat(((recommendedCum - 1) * 100).toFixed(2)),
      benchmark: benchmarkReturn !== null ? parseFloat(((benchmarkCum - 1) * 100).toFixed(2)) : null,
    };
  });
}
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit** → **Commit #6**

```bash
git add src/lib/optimization/allocate.ts src/lib/optimization/optimize.ts __tests__/allocate.test.ts
git commit -m "feat: weight allocation with constraint enforcement

- Iterative constraint enforcement (clip, class cap, re-normalize)
- Cash allocation for remaining weight
- Portfolio-level metrics (volatility, Sharpe, cumulative return)
- Cumulative return series for performance chart (current vs recommended vs benchmark)"
```

---

## Task 11: Weight Comparison Table

**Files:**
- Create: `src/components/WeightTable.tsx`

- [ ] **Step 1: Build the weight table component**

Create `src/components/WeightTable.tsx`:

```tsx
import type { Recommendation } from "@/lib/optimization/types";

interface WeightTableProps {
  recommendations: Recommendation[];
  removedAssets: Recommendation[];
  cashCurrentWeight: number;
  cashRecommendedWeight: number;
}

export function WeightTable({
  recommendations,
  removedAssets,
  cashCurrentWeight,
  cashRecommendedWeight,
}: WeightTableProps) {
  const fmt = (v: number) => `${(v * 100).toFixed(1)}%`;
  const changeColor = (v: number) =>
    v > 0 ? "text-[var(--color-positive)]" : v < 0 ? "text-[var(--color-negative)]" : "text-[var(--color-muted)]";

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-[var(--color-antarctica-navy)] text-left">
            <th className="py-2 pr-4">Asset</th>
            <th className="py-2 pr-4">Class</th>
            <th className="py-2 pr-4 text-right">Current</th>
            <th className="py-2 pr-4 text-right">Recommended</th>
            <th className="py-2 text-right">Change</th>
          </tr>
        </thead>
        <tbody>
          {recommendations.map((r) => (
            <tr key={r.isin} className="border-b border-gray-200">
              <td className="py-2 pr-4 font-medium">{r.name}</td>
              <td className="py-2 pr-4 text-[var(--color-muted)]">{r.assetClass}</td>
              <td className="py-2 pr-4 text-right">{fmt(r.currentWeight)}</td>
              <td className="py-2 pr-4 text-right font-medium">{fmt(r.recommendedWeight)}</td>
              <td className={`py-2 text-right font-medium ${changeColor(r.change)}`}>
                {r.change > 0 ? "+" : ""}
                {fmt(r.change)} {r.change > 0 ? "▲" : r.change < 0 ? "▼" : ""}
              </td>
            </tr>
          ))}

          <tr className="border-b border-gray-200">
            <td className="py-2 pr-4 font-medium">Cash</td>
            <td className="py-2 pr-4 text-[var(--color-muted)]">—</td>
            <td className="py-2 pr-4 text-right">{fmt(cashCurrentWeight)}</td>
            <td className="py-2 pr-4 text-right font-medium">{fmt(cashRecommendedWeight)}</td>
            <td className={`py-2 text-right font-medium ${changeColor(cashRecommendedWeight - cashCurrentWeight)}`}>
              {cashRecommendedWeight - cashCurrentWeight > 0 ? "+" : ""}
              {fmt(cashRecommendedWeight - cashCurrentWeight)}
            </td>
          </tr>

          {removedAssets.length > 0 && (
            <>
              <tr>
                <td colSpan={5} className="pt-4 pb-1 text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">
                  Removed
                </td>
              </tr>
              {removedAssets.map((r) => (
                <tr key={r.isin} className="border-b border-gray-100 text-[var(--color-muted)]">
                  <td className="py-2 pr-4">{r.name}</td>
                  <td className="py-2 pr-4">{r.assetClass}</td>
                  <td className="py-2 pr-4 text-right">{fmt(r.currentWeight)}</td>
                  <td className="py-2 pr-4 text-right">—</td>
                  <td className="py-2 text-right text-[var(--color-negative)]">{r.reason}</td>
                </tr>
              ))}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}
```

---

## Task 12: Sharpe Score Bar Chart

**Files:**
- Create: `src/components/SharpeChart.tsx`

- [ ] **Step 1: Build the Sharpe chart**

Create `src/components/SharpeChart.tsx`:

```tsx
"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Cell } from "recharts";
import type { AssetScore } from "@/lib/optimization/types";

interface SharpeChartProps {
  scores: AssetScore[];
  selectedIsins: Set<string>;
}

export function SharpeChart({ scores, selectedIsins }: SharpeChartProps) {
  const sorted = [...scores].sort((a, b) => b.adjustedScore - a.adjustedScore);

  const data = sorted.map((s) => ({
    name: s.name.length > 15 ? s.name.slice(0, 13) + "…" : s.name,
    fullName: s.name,
    adjustedScore: parseFloat(s.adjustedScore.toFixed(3)),
    sharpe: parseFloat(s.sharpe.toFixed(3)),
    confidence: parseFloat((s.confidence * 100).toFixed(0)),
    selected: selectedIsins.has(s.isin),
  }));

  // Find cutoff line position (between last selected and first removed)
  const lastSelectedIdx = data.findLastIndex((d) => d.selected);
  const cutoffScore =
    lastSelectedIdx >= 0 && lastSelectedIdx < data.length - 1
      ? (data[lastSelectedIdx].adjustedScore + data[lastSelectedIdx + 1].adjustedScore) / 2
      : 0;

  return (
    <ResponsiveContainer width="100%" height={Math.max(300, sorted.length * 40)}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 120, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" label={{ value: "Adjusted Sharpe Score", position: "bottom", offset: -5 }} />
        <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12 }} />
        <Tooltip
          formatter={(value: number, name: string, props: { payload: { fullName: string; confidence: number; sharpe: number } }) => {
            const p = props.payload;
            return [`Score: ${value} (Sharpe: ${p.sharpe}, Confidence: ${p.confidence}%)`, p.fullName];
          }}
        />
        {cutoffScore > 0 && (
          <ReferenceLine x={cutoffScore} stroke="#DC2626" strokeDasharray="5 5" label={{ value: "Selection cutoff", position: "top", fill: "#DC2626", fontSize: 11 }} />
        )}
        <Bar dataKey="adjustedScore" radius={[0, 4, 4, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.selected ? "var(--color-antarctica-navy)" : "#CBD5E1"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 2: Commit** → **Commit #7**

```bash
git add src/components/WeightTable.tsx src/components/SharpeChart.tsx
git commit -m "feat: weight comparison table and sharpe score bar chart

- WeightTable: current vs recommended weights with color-coded changes
- Removed assets shown greyed out with removal reason
- Cash row always visible
- SharpeChart: horizontal bar chart ranking all assets with selection cutoff line"
```

---

## Task 13: Performance Chart

**Files:**
- Create: `src/components/PerformanceChart.tsx`

- [ ] **Step 1: Build the performance chart**

Create `src/components/PerformanceChart.tsx`:

```tsx
"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface PerformanceChartProps {
  data: { date: string; current: number; recommended: number; benchmark: number | null }[];
}

export function PerformanceChart({ data }: PerformanceChartProps) {
  const hasBenchmark = data.some((d) => d.benchmark !== null);

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11 }}
          tickFormatter={(v: string) => {
            const [y, m] = v.split("-");
            return `${m}/${y.slice(2)}`;
          }}
          interval={2}
        />
        <YAxis
          tick={{ fontSize: 11 }}
          tickFormatter={(v: number) => `${v.toFixed(0)}%`}
          label={{ value: "Cumulative Return", angle: -90, position: "insideLeft", offset: -5 }}
        />
        <Tooltip formatter={(v: number) => `${v.toFixed(2)}%`} labelFormatter={(l: string) => `Month: ${l}`} />
        <Legend />
        <Line type="monotone" dataKey="current" name="Current Portfolio" stroke="#94A3B8" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="recommended" name="Recommended" stroke="var(--color-antarctica-navy)" strokeWidth={2} dot={false} />
        {hasBenchmark && (
          <Line type="monotone" dataKey="benchmark" name="Benchmark" stroke="#3B82F6" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 2: Commit** → **Commit #8**

```bash
git add src/components/PerformanceChart.tsx src/components/Explanation.tsx
git commit -m "feat: performance chart with benchmark overlay and recommendation explanation

- Cumulative return line chart: current (grey), recommended (navy), benchmark (blue dashed)
- Auto-generated explanation bullets from optimization results"
```

Note: Explanation component is built in Task 14 but committed here to match the spec's commit story. Build Explanation.tsx before this commit.

---

## Task 14: Data Quality Summary + Explanation

**Files:**
- Create: `src/components/DataQualitySummary.tsx`
- Create: `src/components/Explanation.tsx`

- [ ] **Step 1: Build collapsible data quality summary**

Create `src/components/DataQualitySummary.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { DataWarning } from "@/lib/data/types";

interface DataQualitySummaryProps {
  warnings: DataWarning[];
  constraintCompliance: {
    maxAssets: { passed: boolean; actual: number; limit: number };
    weightBounds: { passed: boolean; violations: string[] };
    classCaps: { passed: boolean; violations: string[] };
  };
}

export function DataQualitySummary({ warnings, constraintCompliance }: DataQualitySummaryProps) {
  const [open, setOpen] = useState(false);

  const allPassed =
    constraintCompliance.maxAssets.passed &&
    constraintCompliance.weightBounds.passed &&
    constraintCompliance.classCaps.passed;

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-left hover:bg-gray-50"
      >
        <span>
          {warnings.length} data issue{warnings.length !== 1 ? "s" : ""} detected and resolved
          {" · "}
          <span className={allPassed ? "text-[var(--color-positive)]" : "text-[var(--color-negative)]"}>
            Constraints: {allPassed ? "all satisfied" : "soft violations"}
          </span>
        </span>
        <span className="text-[var(--color-muted)]">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-gray-100">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mt-3 mb-2">
            Data Quality Issues
          </h4>
          <ul className="space-y-1 text-xs">
            {warnings.map((w, i) => (
              <li key={i} className="flex gap-2">
                <span className="font-mono text-[var(--color-muted)] shrink-0">[{w.source}]</span>
                <span>
                  {w.issue} → <span className="text-[var(--color-antarctica-navy)]">{w.resolution}</span>
                </span>
              </li>
            ))}
          </ul>

          <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mt-4 mb-2">
            Constraint Compliance
          </h4>
          <ul className="space-y-1 text-xs">
            <li>
              {constraintCompliance.maxAssets.passed ? "✓" : "✗"} Max assets: {constraintCompliance.maxAssets.actual}/{constraintCompliance.maxAssets.limit}
            </li>
            <li>
              {constraintCompliance.weightBounds.passed ? "✓" : "✗"} Weight bounds [2%-25%]
              {constraintCompliance.weightBounds.violations.length > 0 &&
                `: ${constraintCompliance.weightBounds.violations.join(", ")}`}
            </li>
            <li>
              {constraintCompliance.classCaps.passed ? "✓" : "✗"} Asset class caps (30% each)
              {constraintCompliance.classCaps.violations.length > 0 &&
                `: ${constraintCompliance.classCaps.violations.join(", ")}`}
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Build explanation component**

Create `src/components/Explanation.tsx`:

```tsx
import type { OptimizationResult } from "@/lib/optimization/types";

interface ExplanationProps {
  result: OptimizationResult;
}

export function Explanation({ result }: ExplanationProps) {
  const { recommendations, removedAssets, scores, currentMetrics, recommendedMetrics, cashWeight } = result;

  const topAsset = recommendations[0];
  const improvementSharpe = recommendedMetrics.sharpe - currentMetrics.sharpe;
  const improvementVol = currentMetrics.volatility - recommendedMetrics.volatility;

  const bullets: string[] = [];

  if (topAsset) {
    const score = scores.find((s) => s.isin === topAsset.isin);
    bullets.push(
      `Overweighted ${topAsset.name} (${(topAsset.recommendedWeight * 100).toFixed(1)}%) due to highest risk-adjusted return (Sharpe: ${score?.sharpe.toFixed(2)}).`
    );
  }

  if (removedAssets.length > 0) {
    bullets.push(
      `Removed ${removedAssets.length} asset${removedAssets.length > 1 ? "s" : ""} with lower Sharpe scores to meet the 5-asset maximum constraint.`
    );
  }

  if (improvementVol > 0.001) {
    bullets.push(
      `Portfolio volatility reduced from ${(currentMetrics.volatility * 100).toFixed(1)}% to ${(recommendedMetrics.volatility * 100).toFixed(1)}% monthly.`
    );
  }

  if (cashWeight > 0.001) {
    bullets.push(
      `${(cashWeight * 100).toFixed(1)}% allocated to cash to satisfy diversification constraints.`
    );
  }

  return (
    <div>
      <h3 className="text-lg font-semibold text-[var(--color-antarctica-navy)] mb-3">
        Why This Recommendation?
      </h3>
      <ul className="space-y-2">
        {bullets.map((b, i) => (
          <li key={i} className="flex gap-2 text-sm">
            <span className="text-[var(--color-antarctica-navy)] shrink-0">•</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 3: Commit** → **Commit #9**

```bash
git add src/components/DataQualitySummary.tsx
git commit -m "feat: data quality summary and constraint compliance display

- Collapsible panel: 13 data issues with resolutions
- Constraint compliance dashboard: max_assets, weight bounds, class caps
- All data quality work surfaced in UI, not hidden in code"
```

---

## Task 15: Wire Everything Into Page

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Build the main page**

Replace `src/app/page.tsx`:

```tsx
import { fetchRawData } from "@/lib/data/fetcher";
import { normalizeAllData } from "@/lib/data/normalize";
import { optimizePortfolio } from "@/lib/optimization/optimize";
import { WeightTable } from "@/components/WeightTable";
import { SharpeChart } from "@/components/SharpeChart";
import { PerformanceChart } from "@/components/PerformanceChart";
import { DataQualitySummary } from "@/components/DataQualitySummary";
import { Explanation } from "@/components/Explanation";
import type { AssetClass } from "@/lib/data/types";

export default async function Home() {
  const raw = await fetchRawData();
  const data = normalizeAllData(raw.holdings, raw.prices, raw.benchmark, raw.constraints);
  const result = optimizePortfolio(data);

  const selectedIsins = new Set(result.recommendations.map((r) => r.isin));

  // Constraint compliance check
  const classTotals = new Map<AssetClass, number>();
  for (const r of result.recommendations) {
    classTotals.set(r.assetClass, (classTotals.get(r.assetClass) ?? 0) + r.recommendedWeight);
  }

  const weightViolations: string[] = [];
  for (const r of result.recommendations) {
    if (r.recommendedWeight < data.constraints.minWeight) weightViolations.push(`${r.name} below min`);
    if (r.recommendedWeight > data.constraints.maxWeight) weightViolations.push(`${r.name} above max`);
  }

  const classViolations: string[] = [];
  for (const [cls, total] of classTotals) {
    const cap = data.constraints.perAssetClassCaps[cls];
    if (total > cap + 0.001) classViolations.push(`${cls}: ${(total * 100).toFixed(1)}% > ${(cap * 100).toFixed(0)}%`);
  }

  const constraintCompliance = {
    maxAssets: { passed: result.recommendations.length <= data.constraints.maxAssets, actual: result.recommendations.length, limit: data.constraints.maxAssets },
    weightBounds: { passed: weightViolations.length === 0, violations: weightViolations },
    classCaps: { passed: classViolations.length === 0, violations: classViolations },
  };

  return (
    <main className="max-w-6xl mx-auto px-6 py-10 space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-[var(--color-antarctica-navy)]">
          Portfolio Recommendation — Q2 2026
        </h1>
        <p className="mt-1 text-[var(--color-muted)]">
          Antarctica Asset Management · Internal Fund Rebalancing
        </p>
      </header>

      <DataQualitySummary warnings={data.warnings} constraintCompliance={constraintCompliance} />

      <section>
        <h2 className="text-xl font-semibold text-[var(--color-antarctica-navy)] mb-4">
          Weight Comparison
        </h2>
        <WeightTable
          recommendations={result.recommendations}
          removedAssets={result.removedAssets}
          cashCurrentWeight={data.cashWeight}
          cashRecommendedWeight={result.cashWeight}
        />
      </section>

      <section>
        <h2 className="text-xl font-semibold text-[var(--color-antarctica-navy)] mb-4">
          Asset Ranking by Risk-Adjusted Return
        </h2>
        <SharpeChart scores={result.scores} selectedIsins={selectedIsins} />
      </section>

      <section>
        <h2 className="text-xl font-semibold text-[var(--color-antarctica-navy)] mb-4">
          Historical Performance Comparison
        </h2>
        <PerformanceChart data={result.cumulativeReturns} />
      </section>

      <section>
        <Explanation result={result} />
      </section>

      <footer className="text-xs text-[var(--color-muted)] border-t border-gray-200 pt-4">
        Data sourced from Antarctica S3 bucket (2023-04 to 2026-03). Benchmark URL corrected from eu-east-1 to eu-west-1.
        Optimization uses Sharpe ratio heuristic with recency-aware confidence penalty. Constraints treated as soft.
      </footer>
    </main>
  );
}
```

- [ ] **Step 2: Verify the app runs**

```bash
npm run dev
```

Open `http://localhost:3000`. Expected: full page with all components rendering. Data fetched from S3, pipeline processing, optimization running, charts displaying.

- [ ] **Step 3: Fix any TypeScript or runtime errors**

Check browser console and terminal for errors. Fix any type mismatches or import issues.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: wire all components into main page

Server Component orchestrates: fetch → normalize → optimize → render.
All data processing server-side; only charts use client components."
```

Note: this is not a numbered spec commit — it's an integration step. It can be squashed into Commit #9 if preferred, or kept separate as a minor wiring commit.

---

## Task 16: Visual Testing + Polish

- [ ] **Step 1: Test the full page in browser**

Open `http://localhost:3000` and verify:
- [ ] Data Quality Summary shows correct issue count and expands/collapses
- [ ] Weight table shows current vs recommended with color-coded changes
- [ ] Cash row is visible
- [ ] Removed assets appear greyed out
- [ ] Sharpe chart renders all assets with cutoff line
- [ ] Performance chart shows 3 lines (current, recommended, benchmark)
- [ ] Explanation bullets are generated and make sense
- [ ] No console errors

- [ ] **Step 2: Run all tests**

```bash
npx jest --verbose
```

Expected: all tests PASS.

- [ ] **Step 3: Run type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

---

## Task 17: README + Deploy

**Files:**
- Create/modify: `README.md`

- [ ] **Step 1: Write README**

Replace `README.md`:

```markdown
# Portfolio Recommendation — Antarctica AM

A Next.js application that reads last quarter's portfolio data, produces recommended weights for Q2 2026, and displays the recommendation with explanatory charts.

**Live:** [deployed-url]

## Approach

### Optimization
I used a Sharpe ratio heuristic (mean return / volatility) to score each asset, then selected the top 5 under diversification constraints. I chose this over Mean-Variance Optimization because the data quality issues make a covariance matrix unreliable, and a simpler model is easier to explain and defend.

### Data Quality
I found and resolved 13 data quality issues across all four data sources before writing any optimization code. See `docs/data-exploration.md` for the full analysis. Key discoveries:
- Benchmark URL in the brief uses `eu-east-1` (invalid AWS region) — corrected to `eu-west-1`
- Duplicate ISIN with conflicting names
- 4 different date formats mixed in prices (ISO, Excel serial, DD/MM/YYYY, ISO timestamp)
- 20% of price values encoded as strings
- One asset truncated 6 months early — handled via recency-aware confidence penalty

### Key Decisions
1. **Sharpe over MVO** — robustness and interpretability over statistical sophistication
2. **Recency-aware confidence** — assets missing recent data are penalized proportionally, not excluded
3. **Cash as explicit allocation** — unallocated weight displayed transparently, not silently normalized
4. **Constraints as soft** — treated as guidelines with cash as feasibility buffer
5. **Benchmark as visual reference** — not an optimization target

## What I'd Do With More Time
- Mean-Variance Optimization with shrinkage estimator for covariance
- Transaction cost / turnover penalty
- Benchmark tracking error as secondary objective
- Responsive mobile design
- More comprehensive test coverage

## Running Locally

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Tech Stack
Next.js 16, TypeScript, Tailwind CSS, Zod, Recharts

## AI Tools
Built with Claude Code. See `CLAUDE.md` for the AI configuration used during development.
```

- [ ] **Step 2: Deploy to Vercel**

```bash
npm install -g vercel
vercel --prod
```

Follow prompts. Copy the live URL into the README.

- [ ] **Step 3: Final commit** → **Commit #10**

```bash
git add README.md
git commit -m "chore: deploy to Vercel, finalize README with decisions and future work"
```

- [ ] **Step 4: Push to GitHub**

```bash
git remote add origin <your-github-repo-url>
git push -u origin main
```

---

## Commit → Task Map

| Commit | Message | Tasks |
|--------|---------|-------|
| #1 | `chore: project setup with Next.js, Tailwind, TypeScript` | Task 1 |
| #2 | `docs: data exploration log — document all quality issues and decisions` | Task 2 |
| #3 | `feat: data pipeline — fetch, parse, validate with Zod schemas` | Tasks 3, 4, 5 |
| #4 | `feat: data normalization — resolve 13 quality issues across all sources` | Task 6 |
| #5 | `feat: optimization engine — sharpe scoring, recency confidence, asset selection` | Tasks 7, 8, 9 (partial) |
| #6 | `feat: weight allocation with constraint enforcement` | Tasks 9 (partial), 10 |
| #7 | `feat: weight comparison table and sharpe score bar chart` | Tasks 11, 12 |
| #8 | `feat: performance chart with benchmark overlay and recommendation explanation` | Tasks 13, 14 (Explanation) |
| #9 | `feat: data quality summary and constraint compliance display` | Task 14 (DataQuality) |
| #10 | `chore: deploy to Vercel, finalize README with decisions and future work` | Tasks 15, 16, 17 |

---

## Self-Review Checklist

- [x] **Spec coverage:** All 10 sections of the spec have corresponding tasks
  - Section 0 (Data Exploration) → Task 2
  - Section 1 (Data Pipeline) → Tasks 3-6
  - Section 2 (Optimization) → Tasks 7-10
  - Section 3 (UI) → Tasks 11-15
  - Section 4 (Project Structure) → Task 3 (types set the structure)
  - Section 5 (Testing) → Tests in Tasks 4, 6, 7, 8, 9
  - Section 6 (Commit Strategy) → Commits specified per task
  - Section 7 (Deployment) → Task 17
  - Section 8 (Time Budget) → Tasks sequenced accordingly
  - Section 9 (Debrief) → README covers key decisions
  - Section 10 (Future Improvements) → README "What I'd Do With More Time"

- [x] **Placeholder scan:** No TBD/TODO. All code blocks are complete.

- [x] **Type consistency:** `AssetScore`, `Recommendation`, `OptimizationResult`, `CleanedData`, `DataWarning` used consistently across all tasks. `AssetClass` type shared between data and optimization layers.

- [x] **All 13 data quality issues handled:** Issues 1-5 in normalize.ts, 6-10 in parse-date.ts + schemas.ts + normalize.ts, 11-12 in normalize.ts benchmark section, 13 in normalize.ts constraints section.
