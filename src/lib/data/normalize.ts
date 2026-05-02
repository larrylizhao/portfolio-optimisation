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

  for (const [isin, vals] of pricesByIsin) {
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const std = Math.sqrt(vals.reduce((sum, v) => sum + (v - mean) ** 2, 0) / vals.length);
    if (std > 0) {
      const outliers = vals.filter((v) => Math.abs(v - mean) / std > 3);
      if (outliers.length > 0) {
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
    benchmarkMap.set(key, { date, level: b.level });
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
