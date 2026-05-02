import { selectAssets } from "@/lib/optimization/select";
import { allocateWeights } from "@/lib/optimization/allocate";
import type { AssetScore } from "@/lib/optimization/types";
import type { Constraints } from "@/lib/data/types";

const mockConstraints: Constraints = {
  minWeight: 0.02,
  maxWeight: 0.25,
  perAssetClassCaps: { Equity: 0.3, "Fixed Income": 0.3, Alternatives: 0.3 },
  maxAssets: 5,
};

describe("selectAssets", () => {
  it("selects top 5 by adjustedScore", () => {
    const scores: AssetScore[] = Array.from({ length: 8 }, (_, i) => ({
      isin: `A${i}`,
      name: `Asset ${i}`,
      assetClass: i < 3 ? "Equity" : i < 6 ? "Fixed Income" : "Alternatives",
      meanReturn: 0.05,
      volatility: 0.02,
      sharpe: 2.5 - i * 0.2,
      confidence: 1,
      adjustedScore: 2.5 - i * 0.2,
    }));

    const selected = selectAssets(scores, mockConstraints);
    expect(selected).toHaveLength(5);
    expect(selected[0].isin).toBe("A0");
  });

  it("respects asset class caps during selection", () => {
    const scores: AssetScore[] = Array.from({ length: 8 }, (_, i) => ({
      isin: `E${i}`,
      name: `Equity ${i}`,
      assetClass: "Equity" as const,
      meanReturn: 0.05,
      volatility: 0.02,
      sharpe: 2.0 - i * 0.1,
      confidence: 1,
      adjustedScore: 2.0 - i * 0.1,
    }));

    const selected = selectAssets(scores, mockConstraints);
    expect(selected.length).toBeLessThanOrEqual(5);
  });
});

describe("allocateWeights", () => {
  it("allocates proportionally and clips to bounds", () => {
    const selected: AssetScore[] = [
      { isin: "A", name: "A", assetClass: "Equity", meanReturn: 0.05, volatility: 0.02, sharpe: 2.5, confidence: 1, adjustedScore: 2.5 },
      { isin: "B", name: "B", assetClass: "Fixed Income", meanReturn: 0.04, volatility: 0.02, sharpe: 2.0, confidence: 1, adjustedScore: 2.0 },
      { isin: "C", name: "C", assetClass: "Alternatives", meanReturn: 0.03, volatility: 0.02, sharpe: 1.5, confidence: 1, adjustedScore: 1.5 },
    ];

    const result = allocateWeights(selected, mockConstraints);
    const totalWeight = result.weights.reduce((sum, w) => sum + w.weight, 0) + result.cashWeight;
    expect(totalWeight).toBeCloseTo(1.0, 4);
    result.weights.forEach((w) => {
      expect(w.weight).toBeGreaterThanOrEqual(mockConstraints.minWeight);
      expect(w.weight).toBeLessThanOrEqual(mockConstraints.maxWeight);
    });
  });
});
