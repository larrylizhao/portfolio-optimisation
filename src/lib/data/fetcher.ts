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
