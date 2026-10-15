import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { parseSerp, normalizeDomain } = await import("./parse");

function loadResult(name: string): unknown {
  const raw = JSON.parse(
    readFileSync(join(process.cwd(), "tests/fixtures/serp", name), "utf8"),
  );
  return raw.tasks[0].result[0];
}

describe("parseSerp", () => {
  it("parses an AI Overview with top-level markdown and references", () => {
    const parsed = parseSerp(loadResult("with-ai-overview.json"));

    expect(parsed.aiOverviewPresent).toBe(true);
    expect(parsed.aiOverviewText).toContain("羅兵咸永道（PwC）");
    expect(parsed.aiOverviewText).toContain("華德會計師事務所");

    expect(parsed.aioReferences.map((r) => r.domain)).toEqual([
      "pwchk.com",
      "zh.wikipedia.org",
      "wardcpa.com.hk",
      "hkicpa.org.hk",
      "bdo.com.hk",
    ]);
    expect(parsed.aioReferences[0]).toEqual({
      domain: "pwchk.com",
      url: "https://www.pwchk.com/zh/services.html",
      title: "服務 | 羅兵咸永道香港",
    });

    expect(parsed.organic).toHaveLength(10);
    expect(parsed.organic.map((o) => o.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(parsed.organic[0]).toEqual({
      rank: 1,
      domain: "wardcpa.com.hk",
      url: "https://www.wardcpa.com.hk/zh/",
      title: "香港會計師事務所推薦｜中小企審計報稅 - 華德會計師事務所",
    });
    expect(parsed.organic[3].domain).toBe("www2.deloitte.com");
  });

  it("reports no AI Overview when the SERP has none", () => {
    const parsed = parseSerp(loadResult("without-ai-overview.json"));

    expect(parsed.aiOverviewPresent).toBe(false);
    expect(parsed.aiOverviewText).toBeNull();
    expect(parsed.aioReferences).toEqual([]);
    expect(parsed.organic.map((o) => [o.rank, o.domain])).toEqual([
      [1, "price.com.hk"],
      [2, "wardcpa.com.hk"],
      [3, "discuss.com.hk"],
      [4, "bdo.com.hk"],
    ]);
  });

  it("falls back to element text and nested references, de-duplicated", () => {
    const parsed = parseSerp(loadResult("ai-overview-nested-elements.json"));

    expect(parsed.aiOverviewPresent).toBe(true);
    expect(parsed.aiOverviewText).toBe(
      "揀牙醫要留意\n可參考香港牙醫管理委員會的註冊名冊，並比較診所位置、收費及專科資歷。\n\n用家評價較多的包括微笑牙科及港島牙科中心。",
    );
    expect(parsed.aioReferences.map((r) => r.domain)).toEqual([
      "dchk.org.hk",
      "openrice.com",
      "smiledental.com.hk",
    ]);
    // local_pack is ignored; organic is sorted by rank and domain derived from url when null.
    expect(parsed.organic.map((o) => [o.rank, o.domain])).toEqual([
      [1, "smiledental.com.hk"],
      [2, "islanddental.com.hk"],
      [3, "openrice.com"],
    ]);
  });

  it("treats an empty async AI Overview placeholder as absent", () => {
    const parsed = parseSerp({
      items: [
        { type: "ai_overview", markdown: null, items: null, references: null, asynchronous_ai_overview: true },
      ],
    });
    expect(parsed.aiOverviewPresent).toBe(false);
    expect(parsed.aiOverviewText).toBeNull();
  });

  it("tolerates null and malformed input", () => {
    const empty = { aiOverviewPresent: false, aiOverviewText: null, aioReferences: [], organic: [] };
    expect(parseSerp(null)).toEqual(empty);
    expect(parseSerp({ items: null })).toEqual(empty);
    expect(parseSerp({ items: [null, 3, { type: "organic", url: "not a url" }] })).toEqual(empty);
  });
});

describe("normalizeDomain", () => {
  it("lowercases, strips www. and derives from url", () => {
    expect(normalizeDomain("WWW.Example.COM")).toBe("example.com");
    expect(normalizeDomain(null, "https://www.foo.hk/bar")).toBe("foo.hk");
    expect(normalizeDomain(null, "nope")).toBeNull();
  });
});
