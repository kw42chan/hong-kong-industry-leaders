import type { AioReference, OrganicResult, ParsedSerp } from "../types";
import { normalizeDomain } from "../dataforseo/parse";

type Obj = Record<string, unknown>;

function isObj(value: unknown): value is Obj {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function objArray(value: unknown): Obj[] {
  return Array.isArray(value) ? value.filter(isObj) : [];
}

function blockText(block: Obj): string | null {
  const own = [str(block.snippet), str(block.title)].filter(Boolean).join("\n");
  const nested = [
    ...objArray(block.list),
    ...objArray(block.text_blocks),
  ]
    .map(blockText)
    .filter(Boolean);
  const parts = [own || null, ...nested].filter(Boolean);
  return parts.length ? parts.join("\n") : null;
}

/** Token for a follow-up AI Overview request, when the search did not include the text. */
export function aiOverviewPageToken(raw: unknown): string | null {
  if (!isObj(raw) || !isObj(raw.ai_overview)) return null;
  const overview = raw.ai_overview;
  if (blockTextFromOverview(overview)) return null;
  return str(overview.page_token);
}

function blockTextFromOverview(overview: Obj): string | null {
  const blocks = objArray(overview.text_blocks).map(blockText).filter(Boolean);
  if (blocks.length) return blocks.join("\n\n");
  return str(overview.snippet);
}

function referencesFrom(overview: Obj): AioReference[] {
  const seen = new Set<string>();
  const refs: AioReference[] = [];
  for (const raw of objArray(overview.references)) {
    const url = str(raw.link) ?? str(raw.url);
    const domain = normalizeDomain(null, url);
    if (!url || !domain) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    refs.push({ domain, url, title: str(raw.title) ?? str(raw.source) ?? domain });
  }
  return refs;
}

/**
 * Parses a SerpAPI Google Search JSON object (after any AI Overview follow-up
 * has been merged onto `ai_overview`) into the ranking fields.
 */
export function parseSerpApi(raw: unknown): ParsedSerp {
  const root = isObj(raw) ? raw : {};
  const overview = isObj(root.ai_overview) ? root.ai_overview : null;
  const aiOverviewText = overview ? blockTextFromOverview(overview) : null;
  const aioReferences = overview ? referencesFrom(overview) : [];

  const organic: OrganicResult[] = [];
  for (const item of objArray(root.organic_results)) {
    const rank = typeof item.position === "number" ? item.position : Number(item.position);
    const url = str(item.link);
    const domain = normalizeDomain(null, url);
    if (!url || !domain || !Number.isFinite(rank) || rank < 1 || rank > 10) continue;
    organic.push({
      rank,
      domain,
      url,
      title: str(item.title) ?? domain,
    });
  }

  return {
    aiOverviewPresent: Boolean(aiOverviewText || aioReferences.length),
    aiOverviewText,
    aioReferences,
    organic,
  };
}

/** Copies a fetched AI Overview onto the original search JSON. */
export function withAiOverview(search: unknown, overviewResponse: unknown): unknown {
  if (!isObj(search)) return search;
  const extra = isObj(overviewResponse) ? overviewResponse.ai_overview : null;
  if (!isObj(extra)) return search;
  return { ...search, ai_overview: extra };
}
