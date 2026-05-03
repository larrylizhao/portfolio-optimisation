import type { AssetClass } from "@/lib/data/types";

export interface MonthlyReturn {
  isin: string;
  month: string; // "YYYY-MM"
  returnValue: number;
}

export interface AssetScore {
  isin: string;
  name: string;
  assetClass: AssetClass;
  meanReturn: number;
  volatility: number;
  sharpe: number;
  confidence: number;
  adjustedScore: number; // sharpe * confidence
}

export interface Recommendation {
  isin: string;
  name: string;
  assetClass: AssetClass;
  currentWeight: number;
  recommendedWeight: number;
  score: number;
  change: number;
  reason: string;
}

export interface PortfolioMetrics {
  volatility: number;
  sharpe: number;
  cumulativeReturn: number;
}

export interface OptimizationResult {
  recommendations: Recommendation[];
  removedAssets: Recommendation[];
  cashWeight: number;
  scores: AssetScore[];
  currentMetrics: PortfolioMetrics;
  recommendedMetrics: PortfolioMetrics;
  cumulativeReturns: {
    date: string;
    current: number;
    recommended: number;
    benchmark: number | null;
  }[];
}
