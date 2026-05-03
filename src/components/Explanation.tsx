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
      `Top allocation: ${topAsset.name} (${(topAsset.recommendedWeight * 100).toFixed(1)}%) — highest risk-adjusted return (Sharpe: ${score?.sharpe.toFixed(2)}).`
    );
  }

  if (removedAssets.length > 0) {
    bullets.push(
      `Removed ${removedAssets.length} asset${removedAssets.length > 1 ? "s" : ""} with lower Sharpe scores to meet the optimized selection criteria.`
    );
  }

  // Relaxation explanation
  if (recommendations.length > 5) {
    bullets.push(
      `Strategically increased asset limit to 6 (from 5) to minimize cash drag and improve capital deployment efficiency.`
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
    <div className="bg-[var(--color-antarctica-navy)] text-white rounded-xl shadow-lg p-6 my-6 relative overflow-hidden">
      {/* Decorative background element */}
      <div className="absolute top-0 right-0 -mt-16 -mr-16 text-white/5" aria-hidden="true">
        <svg width="200" height="200" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L2 22h20L12 2zm0 3.8l7.2 14.2H4.8L12 5.8z" />
        </svg>
      </div>

      <div className="relative z-10">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Quick Summary
        </h3>
        <ul className="space-y-3">
          {bullets.map((b, i) => (
            <li key={i} className="flex gap-3 text-sm leading-relaxed">
              <span className="text-blue-300 shrink-0 mt-0.5" aria-hidden="true">
                <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}