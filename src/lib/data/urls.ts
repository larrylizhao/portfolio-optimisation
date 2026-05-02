const BASE = "https://antarctica-hiring-data.s3.eu-west-1.amazonaws.com/portfolio-optimisation/2026-04";

export const DATA_URLS = {
  holdings: `${BASE}/holdings.json`,
  prices: `${BASE}/prices.json`,
  benchmark: `${BASE}/benchmark.json`,
  constraints: `${BASE}/constraints.json`,
} as const;
