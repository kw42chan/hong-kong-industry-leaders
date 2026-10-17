import type { CitedSource, Leader } from "@/lib/types";
import type { LeadersResult } from "@/lib/ranking/leaders";
import { isAggregatorDomain, normalizeDomain } from "@/lib/ranking/aggregators";
import { isReferrerByHeuristics } from "@/lib/ranking/referrer-heuristics";
import {
  isOperatorFilterEnabled,
  uncertainOperatorMinConfidence,
} from "./config";
import { enrichDomain, type FetchLike } from "./enrich";
import { classifyDomainsBatch } from "./llm";
import type { ClassificationCandidate, OperatorClassification } from "./types";

export interface OperatorFilterDeps {
  classifyBatch?: typeof classifyDomainsBatch;
  enrich?: typeof enrichDomain;
  loadCache?: (
    keyword: string,
    domains: string[],
  ) => Promise<Map<string, OperatorClassification>>;
  saveCache?: (keyword: string, items: OperatorClassification[]) => Promise<void>;
  fetchFn?: FetchLike;
}

function leaderCount(source: Leader): number {
  return Math.max(1, source.queriesAppeared.length);
}

function mergeCited(existing: CitedSource[], domain: string, count: number): CitedSource[] {
  const map = new Map(existing.map((c) => [c.domain, c.count]));
  map.set(domain, (map.get(domain) ?? 0) + count);
  return [...map.entries()]
    .map(([d, c]) => ({ domain: d, count: c }))
    .sort((a, b) => b.count - a.count || (a.domain < b.domain ? -1 : 1));
}

export function isOperatorForLeaders(c: OperatorClassification): boolean {
  if (c.label === "operator") return true;
  if (c.label === "referrer") return false;
  return c.confidence >= uncertainOperatorMinConfidence();
}

/**
 * Applies optional LLM operator/referrer classification to ranked leader candidates.
 * Referrer heuristics and aggregators are handled earlier in computeLeaders.
 */
export async function applyOperatorFilter(
  keyword: string,
  result: LeadersResult,
  candidates: ClassificationCandidate[],
  deps: OperatorFilterDeps = {},
): Promise<LeadersResult> {
  if (!isOperatorFilterEnabled()) return result;

  const classifyBatch = deps.classifyBatch ?? classifyDomainsBatch;
  const enrich = deps.enrich ?? enrichDomain;
  const fetchFn = deps.fetchFn;

  const candidateByDomain = new Map(
    candidates.map((c) => [normalizeDomain(c.domain), c]),
  );
  const domains = result.leaders.map((l) => normalizeDomain(l.domain)).filter(Boolean);

  const cached = deps.loadCache
    ? await deps.loadCache(keyword, domains)
    : new Map<string, OperatorClassification>();

  const toClassify = domains.filter((d) => {
    if (cached.has(d)) return false;
    if (isAggregatorDomain(d) || isReferrerByHeuristics({ domain: d })) return false;
    return true;
  });

  const enriched = await Promise.all(
    toClassify.map((domain) => {
      const c = candidateByDomain.get(domain) ?? { domain, bestTitle: null, bestUrl: null };
      return enrich(c, fetchFn);
    }),
  );

  const fresh =
    enriched.length > 0 ? await classifyBatch(keyword, enriched) : [];

  if (deps.saveCache && fresh.length) {
    await deps.saveCache(keyword, fresh);
  }

  const classification = new Map(cached);
  for (const row of fresh) classification.set(normalizeDomain(row.domain), row);

  const leaders: Leader[] = [];
  let citedSources = result.citedSources;

  for (const leader of result.leaders) {
    const domain = normalizeDomain(leader.domain);
    const c = classification.get(domain);
    if (!c || isOperatorForLeaders(c)) {
      const name =
        c?.companyName && c.label === "operator" ? c.companyName : leader.name;
      leaders.push({ ...leader, name });
      continue;
    }
    citedSources = mergeCited(citedSources, domain, leaderCount(leader));
  }

  leaders.sort(
    (a, b) =>
      b.score - a.score ||
      b.aioMentions + b.aioCitations - (a.aioMentions + a.aioCitations) ||
      (a.bestOrganicRank ?? Infinity) - (b.bestOrganicRank ?? Infinity) ||
      (a.domain < b.domain ? -1 : a.domain > b.domain ? 1 : 0),
  );

  return { leaders, citedSources, classificationCandidates: result.classificationCandidates };
}
