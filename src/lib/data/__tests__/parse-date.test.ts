import { parseDate } from "@/lib/data/parse-date";

describe("parseDate", () => {
  it("parses YYYY-MM-DD format", () => {
    const result = parseDate("2023-04-05");
    expect(result).toBeInstanceOf(Date);
    expect(result!.toISOString().startsWith("2023-04-05")).toBe(true);
  });

  it("parses Excel serial number", () => {
    const result = parseDate(45719);
    expect(result).toBeInstanceOf(Date);
    expect(result!.getFullYear()).toBe(2025);
    expect(result!.getMonth()).toBe(2); // March = 2
    expect(result!.getDate()).toBe(3);
  });

  it("parses DD/MM/YYYY format", () => {
    const result = parseDate("08/04/2025");
    expect(result).toBeInstanceOf(Date);
    expect(result!.toISOString().startsWith("2025-04-08")).toBe(true);
  });

  it("parses ISO 8601 timestamp", () => {
    const result = parseDate("2024-10-03T23:59:59Z");
    expect(result).toBeInstanceOf(Date);
    expect(result!.getFullYear()).toBe(2024);
    expect(result!.getMonth()).toBe(9);
    expect(result!.getDate()).toBe(3);
  });

  it("returns null for unparseable input", () => {
    expect(parseDate("not-a-date")).toBeNull();
    expect(parseDate("")).toBeNull();
  });
});
