export interface RawHolding {
  isin: string;
  name: string;
  asset_class: string;
  currency: string;
  weight: number;
}

export type AssetClass = "Equity" | "Fixed Income" | "Alternatives";

export interface Holding {
  isin: string;
  name: string;
  assetClass: AssetClass;
  currency: string;
  weight: number;
}

export interface PriceRecord {
  date: Date;
  isin: string;
  price: number;
}

export interface BenchmarkRecord {
  date: Date;
  level: number;
}

export interface Constraints {
  minWeight: number;
  maxWeight: number;
  perAssetClassCaps: Record<AssetClass, number>;
  maxAssets: number;
}

export interface DataWarning {
  source: "holdings" | "prices" | "benchmark" | "constraints";
  issue: string;
  resolution: string;
}

export interface CleanedData {
  holdings: Holding[];
  prices: PriceRecord[];
  benchmark: BenchmarkRecord[];
  constraints: Constraints;
  warnings: DataWarning[];
  cashWeight: number;
}
