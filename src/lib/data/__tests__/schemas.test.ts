import { RawHoldingSchema, RawPriceSchema, RawConstraintsSchema } from "../schemas";

describe("RawHoldingSchema", () => {
  it("coerces weight from string to number", () => {
    const input = {
      isin: "NTA001",
      name: "Asset",
      asset_class: "Equity",
      currency: "USD",
      weight: "0.12",
    };
    const result = RawHoldingSchema.parse(input);
    expect(result.weight).toBe(0.12);
  });
});

describe("RawPriceSchema", () => {
  it("coerces price from string to number", () => {
    const input = {
      date: "2024-01-01",
      isin: "NTA001",
      price: "150.5",
    };
    const result = RawPriceSchema.parse(input);
    expect(result.price).toBe(150.5);
  });

  it("accepts number for date (Excel serial)", () => {
    const input = {
      date: 45000,
      isin: "NTA001",
      price: 100,
    };
    const result = RawPriceSchema.parse(input);
    expect(result.date).toBe(45000);
  });
});

describe("RawConstraintsSchema", () => {
  it("validates valid constraints", () => {
    const input = {
      min_weight: 0.02,
      max_weight: 0.25,
      per_asset_class_caps: {
        Equity: 0.3,
        "Fixed Income": 0.3,
        Alternatives: 0.3,
      },
      max_assets: 5,
    };
    expect(() => RawConstraintsSchema.parse(input)).not.toThrow();
  });
});
