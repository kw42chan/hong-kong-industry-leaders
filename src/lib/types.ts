export type SearchStatus = "queued" | "running" | "ready" | "failed";

export const SEARCH_STATUSES = [
  "queued",
  "running",
  "ready",
  "failed",
] as const satisfies readonly SearchStatus[];

export interface AioReference {
  domain: string;
  url: string;
  title: string;
}

export interface OrganicResult {
  rank: number;
  domain: string;
  url: string;
  title: string;
}

export interface ParsedSerp {
  aiOverviewPresent: boolean;
  aiOverviewText: string | null;
  aioReferences: AioReference[];
  organic: OrganicResult[];
}

export interface Leader {
  name: string;
  domain: string;
  score: number;
  aioMentions: number;
  aioCitations: number;
  /** Best (lowest) organic rank across all queries; null if never in organic top 10. */
  bestOrganicRank: number | null;
  queriesAppeared: string[];
}

export interface CitedSource {
  domain: string;
  count: number;
}

export interface SearchQuerySummary {
  text: string;
  aiOverviewPresent: boolean;
}

export interface SearchResultDTO {
  token: string;
  keyword: string;
  status: SearchStatus;
  leaders: Leader[];
  citedSources: CitedSource[];
  queries: SearchQuerySummary[];
  /** ISO 8601 timestamp; null until results are ready. */
  scrapedAt: string | null;
}
