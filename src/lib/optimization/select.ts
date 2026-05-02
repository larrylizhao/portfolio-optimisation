import type { AssetScore } from "./types";
import type { AssetClass, Constraints } from "@/lib/data/types";

export function selectAssets(scores: AssetScore[], constraints: Constraints): AssetScore[] {
  const sorted = [...scores].sort((a, b) => b.adjustedScore - a.adjustedScore);
  const selected: AssetScore[] = [];
  const classCounts = new Map<AssetClass, number>();

  for (const asset of sorted) {
    if (selected.length >= constraints.maxAssets) break;

    const currentCount = classCounts.get(asset.assetClass) ?? 0;
    const cap = constraints.perAssetClassCaps[asset.assetClass] ?? 0.3;
    const estimatedClassWeight = (currentCount + 1) * constraints.minWeight;
    if (estimatedClassWeight > cap) continue;

    selected.push(asset);
    classCounts.set(asset.assetClass, currentCount + 1);
  }

  return selected;
}
