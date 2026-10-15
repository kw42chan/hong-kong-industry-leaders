import type { SearchResultDTO, SearchStatus } from "@/lib/types";

/** Dev-only fixture so the results UI can be viewed without DataForSEO or a database. */
export const MOCK_TOKEN = "mock";

export function isMockEnabled(): boolean {
  return process.env.NODE_ENV !== "production";
}

const queries = [
  "香港 會計師 推薦",
  "香港 邊間會計師樓好",
  "best accounting firm hong kong",
  "香港 中小企 會計服務 推介",
  "香港 核數師 收費",
  "香港 開公司 會計師 邊間好",
];

const readyResult: SearchResultDTO = {
  token: MOCK_TOKEN,
  keyword: "會計師",
  status: "ready",
  leaders: [
    {
      name: "PwC Hong Kong",
      domain: "pwchk.com",
      score: 92.5,
      aioMentions: 5,
      aioCitations: 4,
      bestOrganicRank: 1,
      queriesAppeared: [queries[0], queries[1], queries[2], queries[4], queries[5]],
    },
    {
      name: "Deloitte China",
      domain: "deloitte.com",
      score: 81,
      aioMentions: 4,
      aioCitations: 3,
      bestOrganicRank: 2,
      queriesAppeared: [queries[0], queries[2], queries[4], queries[5]],
    },
    {
      name: "KPMG China",
      domain: "kpmg.com",
      score: 74.25,
      aioMentions: 4,
      aioCitations: 2,
      bestOrganicRank: 4,
      queriesAppeared: [queries[0], queries[1], queries[2]],
    },
    {
      name: "陳氏會計師事務所",
      domain: "chan-cpa.com.hk",
      score: 48,
      aioMentions: 2,
      aioCitations: 1,
      bestOrganicRank: 3,
      queriesAppeared: [queries[3], queries[5]],
    },
    {
      name: "Startup Accounting HK",
      domain: "startupaccounting.hk",
      score: 31.5,
      aioMentions: 0,
      aioCitations: 2,
      bestOrganicRank: 6,
      queriesAppeared: [queries[3]],
    },
    {
      name: "BDO Hong Kong",
      domain: "bdo.com.hk",
      score: 22,
      aioMentions: 1,
      aioCitations: 0,
      bestOrganicRank: null,
      queriesAppeared: [queries[2]],
    },
  ],
  citedSources: [
    { domain: "zh.wikipedia.org", count: 6 },
    { domain: "hkicpa.org.hk", count: 4 },
    { domain: "price.com.hk", count: 3 },
    { domain: "hk.news.yahoo.com", count: 2 },
  ],
  queries: queries.map((text, i) => ({ text, aiOverviewPresent: i !== 4 })),
  scrapedAt: "2026-10-15T09:30:00.000Z",
};

/**
 * `?mock=1` (or `ready`) renders the ready state; `?mock=processing|running|queued|failed`
 * renders the other states.
 */
export function getMockResult(variant: string): SearchResultDTO {
  const status: SearchStatus =
    variant === "processing" || variant === "running"
      ? "running"
      : variant === "queued" || variant === "failed"
        ? variant
        : "ready";
  if (status === "ready") return readyResult;
  return {
    ...readyResult,
    status,
    leaders: [],
    citedSources: [],
    queries: [],
    scrapedAt: null,
  };
}
