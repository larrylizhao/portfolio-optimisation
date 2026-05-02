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
