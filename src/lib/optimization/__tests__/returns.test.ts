import { calculateMonthlyReturns } from "@/lib/optimization/returns";
import type { PriceRecord } from "@/lib/data/types";

describe("calculateMonthlyReturns", () => {
  it("computes monthly return as (last/first - 1)", () => {
    const prices: PriceRecord[] = [
      { date: new Date("2024-01-02"), isin: "A", price: 100 },
      { date: new Date("2024-01-15"), isin: "A", price: 105 },
      { date: new Date("2024-01-31"), isin: "A", price: 110 },
      { date: new Date("2024-02-03"), isin: "A", price: 108 },
      { date: new Date("2024-02-28"), isin: "A", price: 115 },
    ];

    const returns = calculateMonthlyReturns(prices, "A");
    expect(returns).toHaveLength(2);
    expect(returns[0].returnValue).toBeCloseTo(0.10, 4);
    expect(returns[1].returnValue).toBeCloseTo(0.0648, 3);
  });

  it("skips months with only one data point", () => {
    const prices: PriceRecord[] = [
      { date: new Date("2024-01-15"), isin: "A", price: 100 },
    ];

    const returns = calculateMonthlyReturns(prices, "A");
    expect(returns).toHaveLength(0);
  });
});
