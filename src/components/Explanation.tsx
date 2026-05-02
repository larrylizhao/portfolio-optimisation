import type { OptimizationResult } from "@/lib/optimization/types";

interface ExplanationProps {
  result: OptimizationResult;
}

export function Explanation({ result }: ExplanationProps) {
  const { recommendations, removedAssets, scores, currentMetrics, recommendedMetrics, cashWeight } = result;

  const topAsset = recommendations[0];
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
