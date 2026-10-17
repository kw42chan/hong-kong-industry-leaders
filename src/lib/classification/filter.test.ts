import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { LeadersResult } from "@/lib/ranking/leaders";
import type { DomainEnrichmentSignals, OperatorClassification } from "./types";
import { applyOperatorFilter, isOperatorForLeaders } from "./filter";

const baseResult: LeadersResult = {
  leaders: [
    {
      name: "Alpha CPA",
      domain: "alpha.com.hk",
      score: 10,
      aioMentions: 1,
      aioCitations: 0,
      bestOrganicRank: 2,
      queriesAppeared: ["q1"],
    },
    {
      name: "List Site",
      domain: "list.example.com",
      score: 8,
      aioMentions: 0,
      aioCitations: 1,
      bestOrganicRank: 1,
      queriesAppeared: ["q1", "q2"],
    },
  ],
  citedSources: [{ domain: "openrice.com", count: 1 }],
  classificationCandidates: [
    { domain: "alpha.com.hk", bestTitle: "Alpha CPA", bestUrl: "https://alpha.com.hk/" },
    {
      domain: "list.example.com",
      bestTitle: "Top 10 firms",
      bestUrl: "https://list.example.com/top-10",
    },
  ],
};

describe("isOperatorForLeaders", () => {
  it("accepts operator and rejects referrer by default", () => {
    expect(
      isOperatorForLeaders({
        domain: "a.com",
        label: "operator",
        confidence: 0.9,
        reasons: [],
      }),
    ).toBe(true);
    expect(
      isOperatorForLeaders({
        domain: "a.com",
        label: "referrer",
        confidence: 0.99,
        reasons: [],
      }),
    ).toBe(false);
    expect(
      isOperatorForLeaders({
        domain: "a.com",
        label: "uncertain",
        confidence: 0.8,
        reasons: [],
      }),
    ).toBe(false);
  });
});

describe("applyOperatorFilter", () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env, OPERATOR_FILTER_ENABLED: "true" };
  });

  afterEach(() => {
    process.env = env;
  });

  it("passes through when filter flag is off", async () => {
    process.env.OPERATOR_FILTER_ENABLED = "false";
    const out = await applyOperatorFilter("會計師", baseResult, baseResult.classificationCandidates);
    expect(out).toEqual(baseResult);
  });

  it("moves LLM referrers to citedSources", async () => {
    const classifyBatch = vi.fn(async (): Promise<OperatorClassification[]> => [
      {
        domain: "alpha.com.hk",
        label: "operator",
        companyName: "Alpha CPA Limited",
        confidence: 0.95,
        reasons: ["offers audit services"],
      },
      {
        domain: "list.example.com",
        label: "referrer",
        confidence: 0.92,
        reasons: ["top 10 listicle"],
      },
    ]);
    const enrich = vi.fn(
      async (c: { domain: string }): Promise<DomainEnrichmentSignals> => ({
        domain: c.domain,
        homepageUrl: `https://${c.domain}/`,
        pageTitle: null,
        metaDescription: null,
        h1: null,
        organizationName: null,
        organizationTypes: [],
        contactHints: [],
        aboutPageUrl: null,
        aboutSnippet: null,
        fetchErrors: [],
      }),
    );

    const out = await applyOperatorFilter("會計師", baseResult, baseResult.classificationCandidates, {
      classifyBatch,
      enrich,
      loadCache: async () => new Map(),
    });

    expect(out.leaders).toHaveLength(1);
    expect(out.leaders[0].domain).toBe("alpha.com.hk");
    expect(out.leaders[0].name).toBe("Alpha CPA Limited");
    expect(out.citedSources).toEqual(
      expect.arrayContaining([
        { domain: "openrice.com", count: 1 },
        { domain: "list.example.com", count: 2 },
      ]),
    );
    expect(classifyBatch).toHaveBeenCalledOnce();
  });
});
