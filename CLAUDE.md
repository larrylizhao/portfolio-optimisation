# Portfolio Recommendation — AI Guidelines

## Project
Next.js app that recommends portfolio weights using Sharpe-based heuristic.
Deploy target: Vercel. Single-page app, no routing.

## Data Rules
- All data processing server-side (Server Components). Client never touches raw JSON.
- Use Zod with `z.coerce.number()` for price parsing (20% of prices are strings).
- `parseDate()` must handle 4 formats: YYYY-MM-DD, Excel serial int, DD/MM/YYYY, ISO 8601 timestamp.
- Never silently fix data. Log warnings for every correction. Prefer explicit over implicit.
- Weights that don't sum to 1.0: remainder is Cash, not normalized away.
- Duplicate ISINs: merge by summing weights, take first name, log warning.
- Asset class normalization: map all variants to `Equity`, `Fixed Income`, `Alternatives`.

## Algorithm
- Optimization: Sharpe ratio (mean_return / volatility), simple returns (not log), Rf = 0.
- Monthly returns: `(last price of month / first price of month) - 1`.
- Recency-aware confidence: `confidence = recent_12m_days / expected_12m_days`. `adjustedScore = sharpe * confidence`.
- Asset selection: top 5 by adjustedScore, greedy with asset class cap check.
- Constraints are SOFT (per the brief). Treat infeasibility gracefully via Cash allocation.
- Benchmark is a visual reference in charts, not an optimization target.

## Code Style
- All code, comments, commit messages, docs, UI copy in English.
- No `@ts-ignore` or `any` in domain models.
- File structure: `lib/data/` for pipeline, `lib/optimization/` for algorithm, `components/` for UI.
- Client Components (`'use client'`) only for interactive charts. Everything else is Server Components.

## Testing
- Test data normalization, Sharpe calculation, and constraint enforcement.
- No UI tests — verify visually.
