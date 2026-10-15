import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { generateQueries, normalizeKeyword, validateKeyword, MAX_KEYWORD_LENGTH } =
  await import("./generate");

describe("generateQueries", () => {
  it("builds Chinese HK queries for a Chinese keyword", () => {
    expect(generateQueries("會計師", "zh-HK")).toEqual([
      "香港會計師推薦",
      "邊間會計師好",
      "最好嘅會計師香港",
      "會計師比較",
      "香港會計師邊間好",
      "香港十大會計師",
      "best 會計師 Hong Kong",
    ]);
  });

  it("uses the same set for a Chinese keyword regardless of locale", () => {
    expect(generateQueries("牙醫", "en")).toEqual(generateQueries("牙醫", "zh-HK"));
  });

  it("leads with English phrasing for a Latin keyword in the en locale", () => {
    expect(generateQueries("accounting firm", "en")).toEqual([
      "best accounting firm Hong Kong",
      "top accounting firm in Hong Kong",
      "recommended accounting firm Hong Kong",
      "accounting firm Hong Kong comparison",
      "which accounting firm is best in Hong Kong",
      "香港 accounting firm 推薦",
      "邊間 accounting firm 好",
    ]);
  });

  it("leads with spaced Chinese phrasing for a Latin keyword in zh-HK", () => {
    const qs = generateQueries("SEO agency", "zh-HK");
    expect(qs[0]).toBe("香港 SEO agency 推薦");
    expect(qs).toContain("best SEO agency Hong Kong");
  });

  it("never includes a brand query and always returns 6–8 unique queries", () => {
    for (const [kw, locale] of [
      ["會計師", "zh-HK"],
      ["accounting firm", "en"],
      ["accounting firm", "zh-HK"],
      ["  牙醫  ", "en"],
      ["IT 支援", "zh-HK"],
    ]) {
      const qs = generateQueries(kw, locale);
      expect(qs.length).toBeGreaterThanOrEqual(6);
      expect(qs.length).toBeLessThanOrEqual(8);
      expect(new Set(qs).size).toBe(qs.length);
      expect(qs.some((q) => q.includes("好唔好"))).toBe(false);
    }
  });

  it("normalizes whitespace in the keyword", () => {
    expect(generateQueries("  會計\n師 ", "zh-HK")[0]).toBe("香港會計 師推薦");
  });

  it("throws on an empty keyword", () => {
    expect(() => generateQueries("   ", "zh-HK")).toThrow();
  });
});

describe("validateKeyword", () => {
  it("accepts normal keywords", () => {
    expect(validateKeyword("會計師")).toBeNull();
    expect(validateKeyword("accounting firm")).toBeNull();
  });

  it("rejects missing, blank and over-long keywords", () => {
    expect(validateKeyword(undefined)).toBe("missing");
    expect(validateKeyword(42)).toBe("missing");
    expect(validateKeyword(" \t ")).toBe("missing");
    expect(validateKeyword("字".repeat(MAX_KEYWORD_LENGTH + 1))).toBe("too_long");
    expect(validateKeyword("字".repeat(MAX_KEYWORD_LENGTH))).toBeNull();
  });

  it("normalizeKeyword strips control characters", () => {
    expect(normalizeKeyword("a\u0000b\u0007 c")).toBe("a b c");
  });
});
