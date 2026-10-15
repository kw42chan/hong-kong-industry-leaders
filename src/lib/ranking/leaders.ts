import type { CitedSource, Leader, ParsedSerp } from "@/lib/types";
import { isAggregatorDomain, normalizeDomain } from "./aggregators";

/** Points per query whose AI Overview text mentions the brand. */
export const AIO_MENTION_WEIGHT = 10;
/** Points per query whose AI Overview cites the domain as a reference. */
export const AIO_CITATION_WEIGHT = 8;
/** Multiplier on organic points; rank 1 earns ORGANIC_TOP_N points, rank ORGANIC_TOP_N earns 1. */
export const ORGANIC_WEIGHT = 1;
/** Only organic results ranked 1..ORGANIC_TOP_N score. */
export const ORGANIC_TOP_N = 10;

/** Title-derived brand segments longer than this are treated as page headlines, not brands. */
const MAX_BRAND_LENGTH = 40;

/** Host labels skipped when picking the brand label out of a domain. */
const SUFFIX_LABELS = new Set([
  "com",
  "net",
  "org",
  "edu",
  "gov",
  "co",
  "io",
  "biz",
  "info",
  "idv",
  "hk",
  "cn",
  "tw",
  "mo",
  "sg",
  "uk",
  "us",
  "au",
]);

/** Separators between page title and brand, e.g. "Audit Services | ABC CPA". */
const TITLE_SEPARATOR = /\s+[|\-–—:]\s+|[｜：|]/;

export interface SnapshotInput {
  queryText: string;
  parsed: ParsedSerp;
}

export interface LeadersResult {
  leaders: Leader[];
  citedSources: CitedSource[];
}

interface Candidate {
  domain: string;
  bestTitle: string | null;
  bestTitleRank: number;
}

interface Tally {
  score: number;
  aioMentions: number;
  aioCitations: number;
  bestOrganicRank: number | null;
  queriesAppeared: string[];
}

/**
 * Brand label from a domain: the right-most host label that is not a
 * generic suffix. `hk.kpmg.com` → `kpmg`, `abc-cpa.com.hk` → `abc-cpa`.
 */
export function domainLabel(domain: string): string {
  const labels = normalizeDomain(domain).split(".").filter(Boolean);
  for (let i = labels.length - 1; i >= 0; i--) {
    if (!SUFFIX_LABELS.has(labels[i])) return labels[i];
  }
  return labels[0] ?? "";
}

/**
 * Brand from an organic title: when the title has a separator, the last
 * segment is taken as the brand ("Audit Services | ABC CPA" → "ABC CPA").
 * Returns null when there is no separator or the segment looks like a headline.
 */
export function brandFromTitle(title: string): string | null {
  const segments = title
    .split(TITLE_SEPARATOR)
    .map((s) => s.trim())
    .filter(Boolean);
  if (segments.length < 2) return null;
  const last = segments[segments.length - 1];
  if (last.length > MAX_BRAND_LENGTH) return null;
  return last;
}

/**
 * Mention terms for a candidate: the domain label (also with hyphens as
 * spaces) and the title-derived brand. Terms are lowercased; ASCII-only
 * terms shorter than 3 characters and any term shorter than 2 are dropped
 * to avoid noise.
 */
function mentionTerms(candidate: Candidate): string[] {
  const label = domainLabel(candidate.domain);
  const raw = [label, label.replace(/-/g, " ")];
  if (candidate.bestTitle) {
    const brand = brandFromTitle(candidate.bestTitle);
    if (brand) raw.push(brand);
  }
  const terms = new Set<string>();
  for (const term of raw) {
    const t = term.trim().toLowerCase();
    if (t.length < 2) continue;
    if (isAscii(t) && t.length < 3) continue;
    terms.add(t);
  }
  return [...terms];
}

function isAscii(s: string): boolean {
  return /^[\x00-\x7f]*$/.test(s);
}

function isAsciiWordChar(ch: string | undefined): boolean {
  return ch !== undefined && /[a-z0-9]/.test(ch);
}

/**
 * Case-insensitive containment. ASCII terms must sit on word boundaries so
 * "abc" does not match "abcdef"; CJK terms match as plain substrings.
 */
function textMentions(haystackLower: string, termLower: string): boolean {
  if (!isAscii(termLower)) return haystackLower.includes(termLower);
  let from = 0;
  for (;;) {
    const at = haystackLower.indexOf(termLower, from);
    if (at === -1) return false;
    const before = haystackLower[at - 1];
    const after = haystackLower[at + termLower.length];
    if (!isAsciiWordChar(before) && !isAsciiWordChar(after)) return true;
    from = at + 1;
  }
}

function organicPoints(rank: number): number {
  return ORGANIC_TOP_N + 1 - rank;
}

function isTopOrganic(rank: number): boolean {
  return Number.isFinite(rank) && rank >= 1 && rank <= ORGANIC_TOP_N;
}

/**
 * Rank industry leaders across SERP snapshots.
 *
 * Per query, each non-aggregator domain earns:
 *   AIO_MENTION_WEIGHT  if the AI Overview text mentions its brand,
 *   AIO_CITATION_WEIGHT if the AI Overview references it,
 *   ORGANIC_WEIGHT × (ORGANIC_TOP_N + 1 − best rank) if it ranks in the organic top N.
 * Each signal counts at most once per query.
 *
 * Aggregator domains are excluded from leaders; `citedSources.count` is the
 * number of queries in which the domain was an AIO reference or top-N organic result.
 */
export function computeLeaders(snapshots: SnapshotInput[]): LeadersResult {
  const candidates = new Map<string, Candidate>();
  const cited = new Map<string, Set<number>>();

  const seen = (rawDomain: string, queryIndex: number, title?: string, rank?: number) => {
    const domain = normalizeDomain(rawDomain);
    if (!domain) return;
    if (isAggregatorDomain(domain)) {
      let queries = cited.get(domain);
      if (!queries) cited.set(domain, (queries = new Set()));
      queries.add(queryIndex);
      return;
    }
    let c = candidates.get(domain);
    if (!c) {
      c = { domain, bestTitle: null, bestTitleRank: Infinity };
      candidates.set(domain, c);
    }
    if (title && rank !== undefined && rank < c.bestTitleRank) {
      c.bestTitle = title;
      c.bestTitleRank = rank;
    }
  };

  snapshots.forEach(({ parsed }, qi) => {
    for (const ref of parsed.aioReferences) seen(ref.domain || ref.url, qi);
    for (const o of parsed.organic) {
      if (isTopOrganic(o.rank)) seen(o.domain || o.url, qi, o.title, o.rank);
    }
  });

  const terms = new Map<string, string[]>();
  for (const c of candidates.values()) terms.set(c.domain, mentionTerms(c));

  const tallies = new Map<string, Tally>();
  const tallyFor = (domain: string): Tally => {
    let t = tallies.get(domain);
    if (!t) {
      t = { score: 0, aioMentions: 0, aioCitations: 0, bestOrganicRank: null, queriesAppeared: [] };
      tallies.set(domain, t);
    }
    return t;
  };

  for (const { queryText, parsed } of snapshots) {
    const touched = new Set<string>();

    const aioText = parsed.aiOverviewText?.toLowerCase() ?? "";
    if (aioText) {
      for (const [domain, domainTerms] of terms) {
        if (domainTerms.some((term) => textMentions(aioText, term))) {
          const t = tallyFor(domain);
          t.aioMentions += 1;
          t.score += AIO_MENTION_WEIGHT;
          touched.add(domain);
        }
      }
    }

    const citedHere = new Set<string>();
    for (const ref of parsed.aioReferences) {
      const domain = normalizeDomain(ref.domain || ref.url);
      if (candidates.has(domain)) citedHere.add(domain);
    }
    for (const domain of citedHere) {
      const t = tallyFor(domain);
      t.aioCitations += 1;
      t.score += AIO_CITATION_WEIGHT;
      touched.add(domain);
    }

    const bestRankHere = new Map<string, number>();
    for (const o of parsed.organic) {
      if (!isTopOrganic(o.rank)) continue;
      const domain = normalizeDomain(o.domain || o.url);
      if (!candidates.has(domain)) continue;
      const prev = bestRankHere.get(domain);
      if (prev === undefined || o.rank < prev) bestRankHere.set(domain, o.rank);
    }
    for (const [domain, rank] of bestRankHere) {
      const t = tallyFor(domain);
      t.score += ORGANIC_WEIGHT * organicPoints(rank);
      if (t.bestOrganicRank === null || rank < t.bestOrganicRank) t.bestOrganicRank = rank;
      touched.add(domain);
    }

    for (const domain of touched) {
      const t = tallyFor(domain);
      if (!t.queriesAppeared.includes(queryText)) t.queriesAppeared.push(queryText);
    }
  }

  const leaders: Leader[] = [];
  for (const [domain, t] of tallies) {
    const c = candidates.get(domain)!;
    const titleBrand = c.bestTitle ? brandFromTitle(c.bestTitle) : null;
    leaders.push({
      name: titleBrand ?? domainLabel(domain),
      domain,
      score: t.score,
      aioMentions: t.aioMentions,
      aioCitations: t.aioCitations,
      bestOrganicRank: t.bestOrganicRank,
      queriesAppeared: t.queriesAppeared,
    });
  }

  leaders.sort(
    (a, b) =>
      b.score - a.score ||
      b.aioMentions + b.aioCitations - (a.aioMentions + a.aioCitations) ||
      (a.bestOrganicRank ?? Infinity) - (b.bestOrganicRank ?? Infinity) ||
      compareStrings(a.domain, b.domain),
  );

  const citedSources: CitedSource[] = [...cited]
    .map(([domain, queries]) => ({ domain, count: queries.size }))
    .sort((a, b) => b.count - a.count || compareStrings(a.domain, b.domain));

  return { leaders, citedSources };
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
