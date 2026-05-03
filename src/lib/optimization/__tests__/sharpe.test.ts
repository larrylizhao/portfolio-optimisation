import { calculateSharpe, calculateConfidence } from "@/lib/optimization/sharpe";
import type { MonthlyReturn } from "@/lib/optimization/types";

describe("calculateSharpe", () => {
  it("computes mean / std of returns", () => {
    const returns: MonthlyReturn[] = [
      { isin: "A", month: "2024-01", returnValue: 0.05 },
      { isin: "A", month: "2024-02", returnValue: 0.03 },
      { isin: "A", month: "2024-03", returnValue: 0.07 },
      { isin: "A", month: "2024-04", returnValue: 0.01 },
    ];

    const sharpe = calculateSharpe(returns);
    expect(sharpe).toBeGreaterThan(1.5);
    expect(sharpe).toBeLessThan(2.0);
  });

  it("returns 0 for zero volatility", () => {
    const returns: MonthlyReturn[] = [
      { isin: "A", month: "2024-01", returnValue: 0.05 },
      { isin: "A", month: "2024-02", returnValue: 0.05 },
    ];

    expect(calculateSharpe(returns)).toBe(0);
  });
});

describe("calculateConfidence", () => {
  it("returns 1.0 for full data coverage", () => {
    const latestDate = new Date("2026-03-31");
    const assetDates = Array.from({ length: 252 }, (_, i) => {
      const d = new Date("2025-04-01");
      d.setDate(d.getDate() + i);
      return d;
    });
    const allDates = [...assetDates];

    const conf = calculateConfidence(assetDates, allDates, latestDate);
    expect(conf).toBeCloseTo(1.0, 1);
  });

  it("returns ~0.5 for half coverage in recent 12 months", () => {
    const latestDate = new Date("2026-03-31");
    const assetDates = Array.from({ length: 126 }, (_, i) => {
      const d = new Date("2025-04-01");
      d.setDate(d.getDate() + i);
      return d;
    });
    const allDates = Array.from({ length: 252 }, (_, i) => {
      const d = new Date("2025-04-01");
      d.setDate(d.getDate() + i);
      return d;
    });

    const conf = calculateConfidence(assetDates, allDates, latestDate);
    expect(conf).toBeGreaterThan(0.4);
    expect(conf).toBeLessThan(0.6);
  });
});
