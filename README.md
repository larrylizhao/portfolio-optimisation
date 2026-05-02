# Portfolio Recommendation — Antarctica AM

A Next.js application that reads last quarter's portfolio data, produces recommended weights for Q2 2026, and displays the recommendation with explanatory charts.

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
