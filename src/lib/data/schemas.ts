import { z } from "zod";

export const RawHoldingSchema = z.object({
  isin: z.string(),
  name: z.string(),
  asset_class: z.string(),
  currency: z.string(),
  weight: z.coerce.number(),
});

export const RawPriceSchema = z.object({
  date: z.union([z.string(), z.number()]),
  isin: z.string(),
  price: z.coerce.number(),
});

export const RawBenchmarkSchema = z.object({
  date: z.string(),
  level: z.coerce.number(),
});

export const RawConstraintsSchema = z.object({
  min_weight: z.number(),
  max_weight: z.number(),
  per_asset_class_caps: z.record(z.string(), z.number()),
  max_assets: z.number(),
});

export const HoldingsArraySchema = z.array(RawHoldingSchema);
export const PricesArraySchema = z.array(RawPriceSchema);
export const BenchmarkArraySchema = z.array(RawBenchmarkSchema);
