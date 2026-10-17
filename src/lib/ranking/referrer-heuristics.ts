import { isAggregatorDomain, normalizeDomain } from "./aggregators";

/** English / CJK title cues typical of listicles, comparisons, and directories. */
export const REFERRER_TITLE_PATTERNS: readonly RegExp[] = [
  /\bbest\b/i,
  /\btop\s*\d+/i,
  /\bcompare\b/i,
  /\bcomparison\b/i,
  /\bdirectory\b/i,
  /\blist\s+of\b/i,
  /\breview(s)?\b/i,
  /\branking\b/i,
  /\bguide\s+to\b/i,
  /十大/,
  /比較/,
  /推薦清單/,
  /推荐清单/,
  /排行榜/,
  /推介/,
  /精選|精选/,
  /盤點|盘点/,
  /攻略/,
  /懶人包|懒人包/,
  /名單|名单/,
  /vs\.?/i,
];

/** URL path segments that usually indicate editorial/listing pages, not operator homepages. */
export const REFERRER_PATH_PATTERNS: readonly RegExp[] = [
  /\/blog\b/i,
  /\/news\b/i,
  /\/article/i,
  /\/post\b/i,
  /\/compare\b/i,
  /\/comparison\b/i,
  /\/best[-_/]/i,
  /\/top[-_\d]/i,
  /\/list\b/i,
  /\/ranking\b/i,
  /\/review\b/i,
  /\/directory\b/i,
  /\/guide\b/i,
  /\/wiki\b/i,
];

/** Substrings in the hostname (after normalization) that often indicate referrers. */
export const REFERRER_DOMAIN_SUBSTRINGS: readonly string[] = [
  "compare",
  "comparison",
  "review",
  "directory",
  "listicle",
  "top10",
  "top-10",
  "best-",
  "ranking",
  "wiki",
  "blogspot",
  "wordpress",
];

export interface ReferrerHeuristicInput {
  domain: string;
  title?: string | null;
  url?: string | null;
}

export interface ReferrerHeuristicResult {
  isReferrer: boolean;
  reason?: string;
}

export function pathFromUrl(url: string | null | undefined): string {
  if (!url?.trim()) return "";
  try {
    return new URL(url.trim()).pathname.toLowerCase();
  } catch {
    const stripped = url.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
    const pathStart = stripped.indexOf("/");
    return pathStart === -1 ? "" : stripped.slice(pathStart).toLowerCase();
  }
}

/**
 * Cheap rules to detect sites that list or write about an industry rather than
 * operating in it. Aggregator blocklist matches are referrers and must never
 * reach LLM classification.
 */
export function classifyReferrerHeuristic(
  input: ReferrerHeuristicInput,
): ReferrerHeuristicResult {
  const domain = normalizeDomain(input.domain);
  if (!domain) return { isReferrer: false };

  if (isAggregatorDomain(domain)) {
    return { isReferrer: true, reason: "aggregator_blocklist" };
  }

  const host = domain.replace(/^www\./, "");
  for (const sub of REFERRER_DOMAIN_SUBSTRINGS) {
    if (host.includes(sub)) {
      return { isReferrer: true, reason: `domain_contains_${sub}` };
    }
  }

  const title = input.title?.trim() ?? "";
  if (title) {
    for (const pattern of REFERRER_TITLE_PATTERNS) {
      if (pattern.test(title)) {
        return { isReferrer: true, reason: "title_listicle_cue" };
      }
    }
  }

  const path = pathFromUrl(input.url);
  if (path) {
    for (const pattern of REFERRER_PATH_PATTERNS) {
      if (pattern.test(path)) {
        return { isReferrer: true, reason: "path_editorial_cue" };
      }
    }
  }

  return { isReferrer: false };
}

export function isReferrerByHeuristics(input: ReferrerHeuristicInput): boolean {
  return classifyReferrerHeuristic(input).isReferrer;
}
