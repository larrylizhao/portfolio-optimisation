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
