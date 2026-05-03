import { selectAssets } from "../select";
import type { AssetScore } from "../types";
import type { Constraints } from "@/lib/data/types";

const mockConstraints: Constraints = {
  minWeight: 0.02,
  maxWeight: 0.25,
  perAssetClassCaps: { Equity: 0.3, "Fixed Income": 0.3, Alternatives: 0.3 },
  maxAssets: 5,
};

describe("selectAssets", () => {
  it("selects top assets by adjustedScore", () => {
    const scores: AssetScore[] = [
      { isin: "1", name: "A", assetClass: "Equity", meanReturn: 0.1, volatility: 0.05, sharpe: 2, confidence: 1, adjustedScore: 2 },
      { isin: "2", name: "B", assetClass: "Fixed Income", meanReturn: 0.1, volatility: 0.05, sharpe: 1.5, confidence: 1, adjustedScore: 1.5 },
      { isin: "3", name: "C", assetClass: "Alternatives", meanReturn: 0.1, volatility: 0.05, sharpe: 1, confidence: 1, adjustedScore: 1 },
    ];
    const result = selectAssets(scores, mockConstraints);
    expect(result).toHaveLength(3);
    expect(result[0].isin).toBe("1");
    expect(result[1].isin).toBe("2");
    expect(result[2].isin).toBe("3");
  });

  it("respects maxAssets constraint", () => {
    const scores: AssetScore[] = Array.from({ length: 10 }, (_, i) => ({
      isin: `${i}`,
      name: `Asset ${i}`,
      assetClass: "Equity" as const,
      meanReturn: 0.1,
      volatility: 0.05,
      sharpe: 10 - i,
      confidence: 1,
      adjustedScore: 10 - i,
    }));
    const result = selectAssets(scores, { ...mockConstraints, maxAssets: 3 });
    expect(result).toHaveLength(3);
  });

  it("skips assets that would violate class caps (heuristic check)", () => {
    // With 0.3 cap and 0.02 minWeight, it technically allows many assets, 
    // but our selectAssets has: if ((currentCount + 1) * constraints.minWeight > cap) continue;
    // Let's set a tight cap.
    const tightConstraints: Constraints = {
      ...mockConstraints,
      perAssetClassCaps: { Equity: 0.03, "Fixed Income": 0.3, Alternatives: 0.3 },
      minWeight: 0.02,
      maxAssets: 5
    };
    
    const scores: AssetScore[] = [
      { isin: "E1", name: "E1", assetClass: "Equity", meanReturn: 0.1, volatility: 0.05, sharpe: 5, confidence: 1, adjustedScore: 5 },
      { isin: "E2", name: "E2", assetClass: "Equity", meanReturn: 0.1, volatility: 0.05, sharpe: 4, confidence: 1, adjustedScore: 4 },
      { isin: "F1", name: "F1", assetClass: "Fixed Income", meanReturn: 0.1, volatility: 0.05, sharpe: 3, confidence: 1, adjustedScore: 3 },
    ];

    const result = selectAssets(scores, tightConstraints);
    // E1 is picked. E2 would make count 2, 2 * 0.02 = 0.04 > 0.03 cap. So E2 is skipped.
    // F1 is picked.
    expect(result).toHaveLength(2);
    expect(result.map(r => r.isin)).toEqual(["E1", "F1"]);
  });
});
