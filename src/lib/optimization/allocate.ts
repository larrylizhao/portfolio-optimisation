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

    const total = weights.reduce((sum, w) => sum + w.weight, 0);
    if (total > 1.0) {
      const ratio = 1.0 / total;
      for (const w of weights) {
        w.weight *= ratio;
      }
      changed = true;
    }

    if (!changed) break;
  }

  const allocatedTotal = weights.reduce((sum, w) => sum + w.weight, 0);
  const cashWeight = Math.max(0, parseFloat((1 - allocatedTotal).toFixed(10)));

  weights = weights.map((w) => ({ ...w, weight: parseFloat(w.weight.toFixed(4)) }));

  return { weights, cashWeight: parseFloat(cashWeight.toFixed(4)) };
}
