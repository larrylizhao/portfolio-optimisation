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

  const selectedIsins = result.recommendations.map((r) => r.isin);

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
