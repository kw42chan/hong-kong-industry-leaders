import "server-only";
import type { AioReference, OrganicResult, ParsedSerp } from "../types";

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

/** Lowercases and strips a leading `www.`; derives the host from `url` when `domain` is missing. */
export function normalizeDomain(
  domain: string | null,
  url?: string | null,
): string | null {
  let host = domain;
  if (!host && url) {
    try {
      host = new URL(url).hostname;
    } catch {
      return null;
    }
  }
  if (!host) return null;
  return host.toLowerCase().replace(/^www\./, "");
}

function parseReference(ref: Obj): AioReference | null {
  const url = str(ref.url);
  const domain = normalizeDomain(str(ref.domain), url);
  if (!url || !domain) return null;
  return { domain, url, title: str(ref.title) ?? str(ref.source) ?? domain };
}

function aiOverviewText(item: Obj): string | null {
  const markdown = str(item.markdown);
  if (markdown) return markdown;
  const parts = objArray(item.items)
    .map((el) => {
      const md = str(el.markdown);
      if (md) return md;
      return [str(el.title), str(el.text)].filter(Boolean).join("\n");
    })
    .filter(Boolean);
  return parts.length ? parts.join("\n\n") : str(item.text);
}

function aiOverviewReferences(item: Obj): AioReference[] {
  const raw = [
    ...objArray(item.references),
    ...objArray(item.items).flatMap((el) => objArray(el.references)),
  ];
  const seen = new Set<string>();
  const refs: AioReference[] = [];
  for (const r of raw) {
    const ref = parseReference(r);
    if (ref && !seen.has(ref.url)) {
      seen.add(ref.url);
      refs.push(ref);
    }
  }
  return refs;
}

/**
 * Parses one Google Organic Advanced result object (`tasks[i].result[0]`)
 * into the fields the ranking step needs. Tolerates missing/null fields.
 * An `ai_overview` item counts as present only if it has text or references
 * (an unloaded async placeholder does not).
 */
export function parseSerp(rawResult: unknown): ParsedSerp {
  const items = isObj(rawResult) ? objArray(rawResult.items) : [];

  let aiOverviewTextOut: string | null = null;
  let aioReferences: AioReference[] = [];
  const organic: OrganicResult[] = [];

  for (const item of items) {
    if (item.type === "ai_overview" && aiOverviewTextOut === null && !aioReferences.length) {
      aiOverviewTextOut = aiOverviewText(item);
      aioReferences = aiOverviewReferences(item);
    } else if (item.type === "organic") {
      const url = str(item.url);
      const domain = normalizeDomain(str(item.domain), url);
      const rank = typeof item.rank_group === "number" ? item.rank_group : null;
      if (url && domain && rank !== null) {
        organic.push({ rank, domain, url, title: str(item.title) ?? "" });
      }
    }
  }

  organic.sort((a, b) => a.rank - b.rank);

  return {
    aiOverviewPresent: aiOverviewTextOut !== null || aioReferences.length > 0,
    aiOverviewText: aiOverviewTextOut,
    aioReferences,
    organic,
  };
}
