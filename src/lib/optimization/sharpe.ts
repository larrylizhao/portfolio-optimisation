import type { MonthlyReturn } from "./types";

export function calculateSharpe(returns: MonthlyReturn[]): number {
  if (returns.length < 2) return 0;

  const values = returns.map((r) => r.returnValue);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length - 1);
  const std = Math.sqrt(variance);

  if (std === 0) return 0;
  return mean / std;
}

export function calculateConfidence(
  assetDates: Date[],
  allDates: Date[],
  latestDate: Date
): number {
  const twelveMonthsAgo = new Date(latestDate);
  twelveMonthsAgo.setUTCFullYear(twelveMonthsAgo.getUTCFullYear() - 1);

  const recentExpected = allDates.filter((d) => d >= twelveMonthsAgo).length;
  if (recentExpected === 0) return 1;

  const recentActual = assetDates.filter((d) => d >= twelveMonthsAgo).length;
  return recentActual / recentExpected;
}

export function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}
