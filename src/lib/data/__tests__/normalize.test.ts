import { normalizeAssetClass, normalizeCurrency, deduplicateHoldings } from "@/lib/data/normalize";

describe("normalizeAssetClass", () => {
  it("maps lowercase equity", () => {
    expect(normalizeAssetClass("equity")).toBe("Equity");
  });

  it("maps FI to Fixed Income", () => {
    expect(normalizeAssetClass("FI")).toBe("Fixed Income");
  });

  it("maps fixed-income to Fixed Income", () => {
    expect(normalizeAssetClass("fixed-income")).toBe("Fixed Income");
  });

  it("passes through canonical values", () => {
    expect(normalizeAssetClass("Equity")).toBe("Equity");
    expect(normalizeAssetClass("Fixed Income")).toBe("Fixed Income");
    expect(normalizeAssetClass("Alternatives")).toBe("Alternatives");
  });
});

describe("normalizeCurrency", () => {
  it("maps US$ to USD", () => {
    expect(normalizeCurrency("US$")).toBe("USD");
  });

  it("passes through USD", () => {
    expect(normalizeCurrency("USD")).toBe("USD");
  });

  it("passes through EUR", () => {
    expect(normalizeCurrency("EUR")).toBe("EUR");
  });
});

describe("deduplicateHoldings", () => {
  it("merges duplicate ISINs by summing weights", () => {
    const input = [
      { isin: "A", name: "First", asset_class: "Equity", currency: "USD", weight: 0.04 },
      { isin: "A", name: "Second", asset_class: "equity", currency: "USD", weight: 0.04 },
      { isin: "B", name: "Other", asset_class: "Equity", currency: "USD", weight: 0.10 },
    ];
    const { holdings, warnings } = deduplicateHoldings(input);
    expect(holdings).toHaveLength(2);
    expect(holdings[0].weight).toBe(0.08);
    expect(holdings[0].name).toBe("First");
    expect(warnings.length).toBeGreaterThan(0);
  });
});
