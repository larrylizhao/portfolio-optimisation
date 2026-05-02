import type { PriceRecord } from "@/lib/data/types";
import type { MonthlyReturn } from "./types";

export function calculateMonthlyReturns(prices: PriceRecord[], isin: string): MonthlyReturn[] {
  const assetPrices = prices
    .filter((p) => p.isin === isin)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const byMonth = new Map<string, PriceRecord[]>();
  for (const p of assetPrices) {
    const key = `${p.date.getUTCFullYear()}-${String(p.date.getUTCMonth() + 1).padStart(2, "0")}`;
    const arr = byMonth.get(key) ?? [];
    arr.push(p);
    byMonth.set(key, arr);
  }

  const returns: MonthlyReturn[] = [];
  for (const [month, records] of byMonth) {
    if (records.length < 2) continue;
    const first = records[0].price;
    const last = records[records.length - 1].price;
    returns.push({ isin, month, returnValue: last / first - 1 });
  }

  return returns;
}
