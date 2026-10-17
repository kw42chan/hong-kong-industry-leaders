import { describe, expect, it } from "vitest";
import type { ParsedSerp } from "@/lib/types";
import {
  isAggregatorDomain,
  normalizeDomain,
} from "@/lib/ranking/aggregators";
import {
  AIO_CITATION_WEIGHT,
  AIO_MENTION_WEIGHT,
  ORGANIC_TOP_N,
  ORGANIC_WEIGHT,
  brandFromTitle,
  computeLeaders,
  domainLabel,
} from "@/lib/ranking/leaders";

function serp(partial: Partial<ParsedSerp>): ParsedSerp {
  return {
    aiOverviewPresent: partial.aiOverviewText != null,
    aiOverviewText: null,
    aioReferences: [],
    organic: [],
    ...partial,
  };
}

function organic(rank: number, domain: string, title = "Home") {
  return { rank, domain, url: `https://${domain}/`, title };
}

function ref(domain: string) {
  return { domain, url: `https://${domain}/page`, title: "ref" };
}

describe("normalizeDomain", () => {
  it("lowercases and strips www, protocol, path and port", () => {
    expect(normalizeDomain("WWW.ABC-CPA.com.HK")).toBe("abc-cpa.com.hk");
    expect(normalizeDomain("https://www.abc.com:443/path?q=1")).toBe("abc.com");
    expect(normalizeDomain("  abc.com.  ")).toBe("abc.com");
    expect(normalizeDomain("hk.kpmg.com")).toBe("hk.kpmg.com");
  });
});

describe("isAggregatorDomain", () => {
  it("matches listed domains and their subdomains", () => {
    expect(isAggregatorDomain("zh.wikipedia.org")).toBe(true);
    expect(isAggregatorDomain("www.openrice.com")).toBe(true);
    expect(isAggregatorDomain("www.ird.gov.hk")).toBe(true);
    expect(isAggregatorDomain("m.facebook.com")).toBe(true);
    expect(isAggregatorDomain("price.com.hk")).toBe(true);
  });

  it("does not match lookalike domains", () => {
    expect(isAggregatorDomain("notfacebook.com")).toBe(false);
    expect(isAggregatorDomain("abc-cpa.com.hk")).toBe(false);
  });
});

describe("brand heuristics", () => {
  it("takes the brand label from the domain, skipping generic suffixes", () => {
    expect(domainLabel("www.abc-cpa.com.hk")).toBe("abc-cpa");
    expect(domainLabel("hk.kpmg.com")).toBe("kpmg");
  });

  it("takes the last title segment as brand when separated", () => {
    expect(brandFromTitle("Audit Services | ABC CPA")).toBe("ABC CPA");
    expect(brandFromTitle("會計服務｜德勤會計師行")).toBe("德勤會計師行");
    expect(brandFromTitle("Just a page title")).toBeNull();
  });
});

describe("computeLeaders", () => {
  it("returns empty results for empty input", () => {
    expect(computeLeaders([])).toEqual({
      leaders: [],
      citedSources: [],
      classificationCandidates: [],
    });
  });

  it("returns empty results when SERPs have no data", () => {
    expect(
      computeLeaders([{ queryText: "q", parsed: serp({}) }]),
    ).toEqual({ leaders: [], citedSources: [], classificationCandidates: [] });
  });

  it("scores AIO mention, citation and organic rank with the named weights", () => {
    const { leaders } = computeLeaders([
      {
        queryText: "香港 會計師 推薦",
        parsed: serp({
          aiOverviewText: "推薦 ABC CPA 及其他事務所。",
          aioReferences: [ref("www.abc-cpa.com.hk")],
          organic: [organic(3, "www.abc-cpa.com.hk", "Audit | ABC CPA")],
        }),
      },
    ]);
    expect(leaders).toHaveLength(1);
    expect(leaders[0]).toEqual({
      name: "ABC CPA",
      domain: "abc-cpa.com.hk",
      score:
        AIO_MENTION_WEIGHT +
        AIO_CITATION_WEIGHT +
        ORGANIC_WEIGHT * (ORGANIC_TOP_N + 1 - 3),
      aioMentions: 1,
      aioCitations: 1,
      bestOrganicRank: 3,
      queriesAppeared: ["香港 會計師 推薦"],
    });
  });

  it("orders leaders by aggregated score across queries", () => {
    const { leaders } = computeLeaders([
      {
        queryText: "q1",
        parsed: serp({
          aiOverviewText: "Top firms include Alpha Partners.",
          aioReferences: [ref("alpha.com.hk")],
          organic: [
            organic(1, "beta.com", "Beta | Beta Ltd"),
            organic(2, "alpha.com.hk", "Home | Alpha Partners"),
            organic(5, "gamma.hk"),
          ],
        }),
      },
      {
        queryText: "q2",
        parsed: serp({
          organic: [
            organic(1, "www.alpha.com.hk"),
            organic(4, "gamma.hk"),
            organic(11, "beta.com"),
          ],
        }),
      },
    ]);

    expect(leaders.map((l) => l.domain)).toEqual([
      "alpha.com.hk",
      "gamma.hk",
      "beta.com",
    ]);
    const alpha = leaders[0];
    expect(alpha.aioMentions).toBe(1);
    expect(alpha.aioCitations).toBe(1);
    expect(alpha.bestOrganicRank).toBe(1);
    expect(alpha.queriesAppeared).toEqual(["q1", "q2"]);
    // Rank 11 is outside the top N and contributes nothing.
    expect(leaders[2].queriesAppeared).toEqual(["q1"]);
    expect(leaders[2].bestOrganicRank).toBe(1);
  });

  it("merges www/case variants of the same domain", () => {
    const { leaders } = computeLeaders([
      { queryText: "q1", parsed: serp({ organic: [organic(1, "WWW.Alpha.COM")] }) },
      { queryText: "q2", parsed: serp({ organic: [organic(2, "alpha.com")] }) },
    ]);
    expect(leaders).toHaveLength(1);
    expect(leaders[0].domain).toBe("alpha.com");
    expect(leaders[0].score).toBe(ORGANIC_WEIGHT * (ORGANIC_TOP_N + ORGANIC_TOP_N - 1));
  });

  it("counts each signal at most once per query", () => {
    const { leaders } = computeLeaders([
      {
        queryText: "q",
        parsed: serp({
          aiOverviewText: "Alpha is great. Alpha again.",
          aioReferences: [ref("alpha.com"), ref("www.alpha.com")],
          organic: [organic(2, "alpha.com"), organic(6, "alpha.com")],
        }),
      },
    ]);
    expect(leaders[0].aioMentions).toBe(1);
    expect(leaders[0].aioCitations).toBe(1);
    expect(leaders[0].bestOrganicRank).toBe(2);
  });

  it("does not match ASCII brands inside longer words", () => {
    const { leaders } = computeLeaders([
      {
        queryText: "q",
        parsed: serp({
          aiOverviewText: "Visit abcdef for details.",
          organic: [organic(5, "abc.com")],
        }),
      },
    ]);
    expect(leaders[0].aioMentions).toBe(0);
  });

  it("excludes listicle organic titles via referrer heuristics", () => {
    const { leaders, citedSources } = computeLeaders([
      {
        queryText: "q",
        parsed: serp({
          organic: [
            organic(1, "magazine.hk", "2025 十大香港會計師推薦清單"),
            organic(2, "real-firm.com.hk", "核數服務 | Real Firm"),
          ],
        }),
      },
    ]);
    expect(leaders.map((l) => l.domain)).toEqual(["real-firm.com.hk"]);
    expect(citedSources).toEqual([{ domain: "magazine.hk", count: 1 }]);
  });

  it("excludes aggregators from leaders and reports them as cited sources", () => {
    const { leaders, citedSources } = computeLeaders([
      {
        queryText: "q1",
        parsed: serp({
          aiOverviewText: "According to Wikipedia and OpenRice...",
          aioReferences: [ref("zh.wikipedia.org"), ref("www.openrice.com")],
          organic: [
            organic(1, "www.openrice.com"),
            organic(2, "www.facebook.com"),
            organic(3, "alpha.com"),
          ],
        }),
      },
      {
        queryText: "q2",
        parsed: serp({
          aioReferences: [ref("openrice.com")],
          organic: [organic(1, "www.ird.gov.hk"), organic(2, "alpha.com")],
        }),
      },
    ]);

    expect(leaders.map((l) => l.domain)).toEqual(["alpha.com"]);
    expect(citedSources).toEqual([
      { domain: "openrice.com", count: 2 },
      { domain: "facebook.com", count: 1 },
      { domain: "ird.gov.hk", count: 1 },
      { domain: "zh.wikipedia.org", count: 1 },
    ]);
  });

  it("is deterministic regardless of call repetition and breaks ties by domain", () => {
    const input = [
      {
        queryText: "q",
        parsed: serp({ organic: [organic(3, "zeta.com"), organic(3, "eta.com")] }),
      },
    ];
    const first = computeLeaders(input);
    expect(computeLeaders(input)).toEqual(first);
    expect(first.leaders.map((l) => l.domain)).toEqual(["eta.com", "zeta.com"]);
  });
});
