import type { Recommendation } from "@/lib/optimization/types";
import type { AssetClass } from "@/lib/data/types";

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
    v > 0 ? "text-[var(--color-positive)]" : v < 0 ? "text-[var(--color-negative)]" : "text-gray-400";

  const cashAssetClass: AssetClass = "Alternatives";

  const allTargets = [
    ...recommendations,
    {
      isin: "CASH-USD",
      name: "Strategic Cash Reserve",
      assetClass: cashAssetClass,
      currentWeight: cashCurrentWeight,
      recommendedWeight: cashRecommendedWeight,
      score: 0,
      change: cashRecommendedWeight - cashCurrentWeight,
      reason: "Liquidity buffer"
    }
  ].sort((a, b) => b.recommendedWeight - a.recommendedWeight);

  return (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100 font-sans">
      {/* Header Section */}
      <div className="bg-[#002D54] p-6 flex justify-between items-center text-white">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 w-9 h-9 flex items-center justify-center rounded-lg">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
              <path d="M22 12A10 10 0 0 0 12 2v10z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold tracking-tight">Target Allocation Recommendation</h2>
        </div>
      </div>

      {/* Table Content */}
      <div className="p-2 overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="text-[11px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-50">
              <th className="px-6 py-4 text-left">Asset / Region</th>
              <th className="px-4 py-4 text-center">Efficiency (Sharpe)</th>
              <th className="px-4 py-4 text-right">Current</th>
              <th className="px-4 py-4 text-right">Change</th>
              <th className="px-6 py-4 text-right">Target Weight</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {allTargets.map((r) => (
              <tr key={r.isin} className="group hover:bg-gray-50/50 transition-all duration-300">
                <td className="px-6 py-6 transition-transform duration-300 group-hover:translate-x-1">
                  <div className="flex flex-col">
                    <span className="text-base font-bold text-[#002D54] group-hover:text-blue-700 transition-colors">
                      {r.name}
                    </span>
                    <div className="flex items-center gap-2 mt-1 text-[10px] font-bold tracking-wider uppercase">
                      <span className="text-gray-500">{r.isin}</span>
                      <span className="text-gray-300">•</span>
                      <span className="text-blue-600 font-extrabold">{r.assetClass}</span>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-6 text-center">
                  <span className="font-mono text-sm font-semibold text-gray-600">
                    {r.score === 0 ? "0.00" : r.score.toFixed(2)}
                  </span>
                </td>
                <td className="px-4 py-6 text-right tabular-nums text-sm font-medium text-gray-500">
                  {fmt(r.currentWeight)}
                </td>
                <td className={`px-4 py-6 text-right tabular-nums text-sm font-bold ${changeColor(r.change)}`}>
                  {r.change > 0 ? "+" : ""}{fmt(r.change)}
                </td>
                <td className="px-6 py-6">
                  <div className="flex flex-col items-end">
                    <span className="text-2xl font-bold text-[#002D54] tabular-nums">
                      {fmt(r.recommendedWeight)}
                    </span>
                    <div className="w-32 h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden relative">
                      <div
                        className="h-full bg-blue-600 rounded-full transition-all duration-1000 ease-out"
                        style={{ width: `${r.recommendedWeight * 100}%` }}
                      />
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Removed Assets Section */}
      {removedAssets.length > 0 && (
        <div className="border-t border-gray-50 bg-gray-50/30 p-4">
          <details className="group">
            <summary className="text-[10px] font-bold text-gray-400 uppercase tracking-widest cursor-pointer list-none flex items-center justify-center gap-2 hover:text-gray-600 transition-colors">
              <span>View Removed Liquidation Targets</span>
              <svg className="w-3 h-3 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div className="mt-4 px-4 pb-2 divide-y divide-gray-100">
              {removedAssets.map((r) => (
                <div key={r.isin} className="py-3 flex justify-between items-center opacity-70 grayscale hover:opacity-100 hover:grayscale-0 transition-all group/item hover:translate-x-1 duration-300 cursor-default">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-bold text-gray-700">{r.name}</span>
                    <span className="text-xs text-gray-500 uppercase tracking-tighter font-semibold">{r.assetClass}</span>
                  </div>
                  <div className="flex items-center gap-6">
                    <span className="text-xs font-mono text-gray-400 line-through">Prev: {fmt(r.currentWeight)}</span>
                    <div className="text-xs font-medium text-red-500 bg-red-50/50 px-2.5 py-1 rounded-lg italic border border-red-100/50">
                      {r.reason}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}

      {/* Footer */}
      <div className="bg-gray-50 py-4 text-center">
        <span className="text-[10px] font-bold text-gray-300 uppercase tracking-[0.2em]">
          End of Allocation Report
        </span>
      </div>
    </div>
  );
}
