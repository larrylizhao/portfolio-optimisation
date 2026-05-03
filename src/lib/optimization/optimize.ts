import type { CleanedData } from "@/lib/data/types";
import type { AssetScore, OptimizationResult, Recommendation } from "./types";
import { calculateMonthlyReturns } from "./returns";
import { calculateSharpe, calculateConfidence, mean, stdDev } from "./sharpe";
import { selectAssets } from "./select";
import { allocateWeights } from "./allocate";

export function optimizePortfolio(data: CleanedData): OptimizationResult {
  const { holdings, prices, benchmark, constraints } = data;

  const allDates = [...new Set(prices.map((p) => p.date.getTime()))].map((t) => new Date(t));
  allDates.sort((a, b) => a.getTime() - b.getTime());
  const latestDate = allDates[allDates.length - 1];

  // --- Step 1: Score Assets ---
  const scores: AssetScore[] = holdings.map((h) => {
    const monthlyReturns = calculateMonthlyReturns(prices, h.isin);
    const sharpe = calculateSharpe(monthlyReturns);

    const assetDates = prices.filter((p) => p.isin === h.isin).map((p) => p.date);
    const confidence = calculateConfidence(assetDates, allDates, latestDate);

    return {
      isin: h.isin,
      name: h.name,
      assetClass: h.assetClass,
      meanReturn: monthlyReturns.length > 0 ? mean(monthlyReturns.map((r) => r.returnValue)) : 0,
      volatility: monthlyReturns.length > 0 ? stdDev(monthlyReturns.map((r) => r.returnValue)) : 0,
      sharpe,
      confidence,
      adjustedScore: sharpe * confidence,
    };
  });

  // --- Step 2: Select Assets ---
  const selected = selectAssets(scores, constraints);
  const selectedIsins = new Set(selected.map((s) => s.isin));

  // --- Step 3: Allocate Weights ---
  const { weights, cashWeight } = allocateWeights(selected, constraints);

  // --- Step 4: Build Results ---
  const recommendations: Recommendation[] = weights.map((w) => {
    const holding = holdings.find((h) => h.isin === w.isin)!;
    const score = scores.find((s) => s.isin === w.isin)!;
    const change = w.weight - holding.weight;
    return {
      isin: w.isin,
      name: w.name,
      assetClass: w.assetClass,
      currentWeight: holding.weight,
      recommendedWeight: w.weight,
      score: score.adjustedScore,
      change: parseFloat(change.toFixed(4)),
      reason: `Adjusted Sharpe score: ${score.adjustedScore.toFixed(2)} (rank #${selected.indexOf(score) + 1})`,
    };
  });

  const removedAssets: Recommendation[] = holdings
    .filter((h) => !selectedIsins.has(h.isin))
    .map((h) => {
      const score = scores.find((s) => s.isin === h.isin)!;
      let reason = `Adjusted Sharpe: ${score.adjustedScore.toFixed(2)} — below selection threshold`;
      if (score.confidence < 1) {
        reason += ` (confidence penalty: ${(score.confidence * 100).toFixed(0)}%)`;
      }
      return {
        isin: h.isin,
        name: h.name,
        assetClass: h.assetClass,
        currentWeight: h.weight,
        recommendedWeight: 0,
        score: score.adjustedScore,
        change: -h.weight,
        reason,
      };
    });

  const cumulativeReturns = calculateCumulativeReturns(
    prices,
    benchmark,
    holdings,
    recommendations,
    cashWeight
  );

  const currentMetrics = calculatePortfolioMetrics(prices, holdings);
  const recWeights = recommendations.map((r) => ({ isin: r.isin, weight: r.recommendedWeight }));
  const recommendedMetrics = calculatePortfolioMetrics(prices, recWeights);

  return {
    recommendations,
    removedAssets,
    cashWeight,
    scores,
    currentMetrics,
    recommendedMetrics,
    cumulativeReturns,
  };
}

function calculatePortfolioMetrics(
  prices: { date: Date; isin: string; price: number }[],
  weights: { isin: string; weight: number }[]
): { volatility: number; sharpe: number; cumulativeReturn: number } {
  const allMonthlyReturns = new Map<string, number>();

  for (const { isin, weight } of weights) {
    const assetPrices = prices.filter((p) => p.isin === isin).sort((a, b) => a.date.getTime() - b.date.getTime());
    const byMonth = new Map<string, { first: number; last: number }>();

    for (const p of assetPrices) {
      const key = `${p.date.getUTCFullYear()}-${String(p.date.getUTCMonth() + 1).padStart(2, "0")}`;
      const existing = byMonth.get(key);
      if (!existing) {
        byMonth.set(key, { first: p.price, last: p.price });
      } else {
        existing.last = p.price;
      }
    }

    for (const [month, { first, last }] of byMonth) {
      const ret = (last / first - 1) * weight;
      allMonthlyReturns.set(month, (allMonthlyReturns.get(month) ?? 0) + ret);
    }
  }

  const returns = Array.from(allMonthlyReturns.values());
  if (returns.length === 0) return { volatility: 0, sharpe: 0, cumulativeReturn: 0 };

  const m = returns.reduce((a, b) => a + b, 0) / returns.length;
  const v = Math.sqrt(returns.reduce((sum, r) => sum + (r - m) ** 2, 0) / (returns.length - 1));
  const cumulative = returns.reduce((acc, r) => acc * (1 + r), 1) - 1;

  return { volatility: v, sharpe: v > 0 ? m / v : 0, cumulativeReturn: cumulative };
}

function calculateCumulativeReturns(
  prices: { date: Date; isin: string; price: number }[],
  benchmark: { date: Date; level: number }[],
  currentHoldings: { isin: string; weight: number }[],
  recommendations: { isin: string; recommendedWeight: number }[],
  cashWeight: number
): { date: string; current: number; recommended: number; benchmark: number | null }[] {
  const months = new Set<string>();
  for (const p of prices) {
    months.add(`${p.date.getUTCFullYear()}-${String(p.date.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  const sortedMonths = Array.from(months).sort();

  // Single sort, single pass for both first and last prices per month
  const sortedPrices = [...prices].sort((a, b) => a.date.getTime() - b.date.getTime());

  const firstPrices = new Map<string, Map<string, number>>();
  const lastPrices = new Map<string, Map<string, number>>();
  for (const p of sortedPrices) {
    const month = `${p.date.getUTCFullYear()}-${String(p.date.getUTCMonth() + 1).padStart(2, "0")}`;
    const firstMap = firstPrices.get(p.isin) ?? new Map<string, number>();
    if (!firstMap.has(month)) {
      firstMap.set(month, p.price);
    }
    firstPrices.set(p.isin, firstMap);

    const lastMap = lastPrices.get(p.isin) ?? new Map<string, number>();
    lastMap.set(month, p.price);
    lastPrices.set(p.isin, lastMap);
  }

  const benchmarkByMonth = new Map<string, { first: number; last: number }>();
  const sortedBenchmark = [...benchmark].sort((a, b) => a.date.getTime() - b.date.getTime());
  for (const b of sortedBenchmark) {
    const month = `${b.date.getUTCFullYear()}-${String(b.date.getUTCMonth() + 1).padStart(2, "0")}`;
    const existing = benchmarkByMonth.get(month);
    if (!existing) {
      benchmarkByMonth.set(month, { first: b.level, last: b.level });
    } else {
      existing.last = b.level;
    }
  }

  let currentCum = 1;
  let recommendedCum = 1;
  let benchmarkCum = 1;

  void cashWeight;

  return sortedMonths.map((month) => {
    let currentReturn = 0;
    for (const h of currentHoldings) {
      const first = firstPrices.get(h.isin)?.get(month);
      const last = lastPrices.get(h.isin)?.get(month);
      if (first && last) {
        currentReturn += (last / first - 1) * h.weight;
      }
    }

    let recommendedReturn = 0;
    for (const r of recommendations) {
      const first = firstPrices.get(r.isin)?.get(month);
      const last = lastPrices.get(r.isin)?.get(month);
      if (first && last) {
        recommendedReturn += (last / first - 1) * r.recommendedWeight;
      }
    }

    const bm = benchmarkByMonth.get(month);
    let benchmarkReturn: number | null = null;
    if (bm) {
      benchmarkReturn = bm.last / bm.first - 1;
    }

    currentCum *= 1 + currentReturn;
    recommendedCum *= 1 + recommendedReturn;
    if (benchmarkReturn !== null) {
      benchmarkCum *= 1 + benchmarkReturn;
    }

    return {
      date: month,
      current: parseFloat(((currentCum - 1) * 100).toFixed(2)),
      recommended: parseFloat(((recommendedCum - 1) * 100).toFixed(2)),
      benchmark: benchmarkReturn !== null ? parseFloat(((benchmarkCum - 1) * 100).toFixed(2)) : null,
    };
  });
}
