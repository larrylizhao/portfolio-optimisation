import type { AssetScore } from "./types";
import type { AssetClass, Constraints } from "@/lib/data/types";

interface WeightedAsset {
  isin: string;
  name: string;
  assetClass: AssetClass;
  weight: number;
}

export function allocateWeights(
  selected: AssetScore[],
  constraints: Constraints
): { weights: WeightedAsset[]; cashWeight: number } {
  if (selected.length === 0) {
    return { weights: [], cashWeight: 1.0 };
  }

  const totalScore = selected.reduce((sum, s) => sum + s.adjustedScore, 0);

  let weights: WeightedAsset[] = selected.map((s) => ({
    isin: s.isin,
    name: s.name,
    assetClass: s.assetClass,
    weight: totalScore > 0 ? s.adjustedScore / totalScore : 1 / selected.length,
  }));

  for (let iter = 0; iter < 10; iter++) {
    let changed = false;

    // Step A: Clip individual weights to [min, max]
    for (const w of weights) {
      if (w.weight < constraints.minWeight) {
        w.weight = constraints.minWeight;
        changed = true;
      }
      if (w.weight > constraints.maxWeight) {
        w.weight = constraints.maxWeight;
        changed = true;
      }
    }

    // Step B: Enforce asset class caps
    const classTotals = new Map<AssetClass, number>();
    for (const w of weights) {
      classTotals.set(w.assetClass, (classTotals.get(w.assetClass) ?? 0) + w.weight);
    }

    for (const [cls, total] of classTotals) {
      const cap = constraints.perAssetClassCaps[cls] ?? 0.3;
      if (total > cap + 0.001) {
        const ratio = cap / total;
        for (const w of weights) {
          if (w.assetClass === cls) {
            w.weight *= ratio;
            changed = true;
          }
        }
      }
    }

    // Step C: Normalize down if total > 100%
    const total = weights.reduce((sum, w) => sum + w.weight, 0);
    if (total > 1.0) {
      const ratio = 1.0 / total;
      for (const w of weights) {
        w.weight *= ratio;
      }
      changed = true;
    }

    // Step D: Redistribute surplus to assets with headroom
    const currentTotal = weights.reduce((sum, w) => sum + w.weight, 0);
    const surplus = 1.0 - currentTotal;
    if (surplus > 0.001) {
      const classCurrentTotals = new Map<AssetClass, number>();
      for (const w of weights) {
        classCurrentTotals.set(w.assetClass, (classCurrentTotals.get(w.assetClass) ?? 0) + w.weight);
      }

      const eligible = weights.filter((w) => {
        const classCap = constraints.perAssetClassCaps[w.assetClass] ?? 0.3;
        const classTotal = classCurrentTotals.get(w.assetClass) ?? 0;
        return w.weight < constraints.maxWeight && classTotal < classCap - 0.001;
      });

      if (eligible.length > 0) {
        const eligibleScoreSum = eligible.reduce((sum, w) => {
          const score = selected.find((s) => s.isin === w.isin)?.adjustedScore ?? 1;
          return sum + score;
        }, 0);

        for (const w of eligible) {
          const score = selected.find((s) => s.isin === w.isin)?.adjustedScore ?? 1;
          const share = (score / eligibleScoreSum) * surplus;

          const maxByAsset = constraints.maxWeight - w.weight;
          const classCap = constraints.perAssetClassCaps[w.assetClass] ?? 0.3;
          const classTotal = classCurrentTotals.get(w.assetClass) ?? 0;
          const maxByClass = classCap - classTotal;

          const addition = Math.min(share, maxByAsset, maxByClass);
          if (addition > 0.0001) {
            w.weight += addition;
            classCurrentTotals.set(w.assetClass, (classCurrentTotals.get(w.assetClass) ?? 0) + addition);
            changed = true;
          }
        }
      }
    }

    if (!changed) break;
  }

  const allocatedTotal = weights.reduce((sum, w) => sum + w.weight, 0);
  const cashWeight = Math.max(0, parseFloat((1 - allocatedTotal).toFixed(10)));

  weights = weights.map((w) => ({ ...w, weight: parseFloat(w.weight.toFixed(4)) }));

  return { weights, cashWeight: parseFloat(cashWeight.toFixed(4)) };
}
