import { ENRICH_MAX_BYTES, ENRICH_TIMEOUT_MS, enrichmentEnabled } from "./config";
import type { ClassificationCandidate, DomainEnrichmentSignals } from "./types";
import { normalizeDomain } from "@/lib/ranking/aggregators";

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

const DEFAULT_FETCH: FetchLike = (url, init) => fetch(url, init);

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstMatch(html: string, pattern: RegExp): string | null {
  const m = html.match(pattern);
  return m?.[1]?.trim() ?? null;
}

function extractJsonLdBlocks(html: string): unknown[] {
  const out: unknown[] = [];
  const re =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const m of html.matchAll(re)) {
    const raw = m[1]?.trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) out.push(...parsed);
      else out.push(parsed);
    } catch {
      /* ignore malformed JSON-LD */
    }
  }
  return out;
}

function collectOrganizations(node: unknown, acc: { name?: string; types: Set<string> }): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) collectOrganizations(item, acc);
    return;
  }
  const obj = node as Record<string, unknown>;
  if (obj["@graph"]) collectOrganizations(obj["@graph"], acc);
  const typeRaw = obj["@type"];
  const types = Array.isArray(typeRaw) ? typeRaw : typeRaw ? [typeRaw] : [];
  for (const t of types) {
    if (typeof t !== "string") continue;
    const lower = t.toLowerCase();
    if (
      lower.includes("organization") ||
      lower.includes("localbusiness") ||
      lower.includes("corporation") ||
      lower.includes("professional")
    ) {
      acc.types.add(t);
      if (typeof obj.name === "string" && !acc.name) acc.name = obj.name;
    }
  }
  for (const value of Object.values(obj)) {
    if (value && typeof value === "object") collectOrganizations(value, acc);
  }
}

function findAboutLink(html: string, baseUrl: string): string | null {
  const re = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const m of html.matchAll(re)) {
    const href = m[1];
    const text = stripTags(m[2] ?? "").toLowerCase();
    if (!href || !text) continue;
    if (
      /about|關於|关于|公司簡介|公司简介|who we are|our story|關於我們|关于我们/.test(
        text,
      )
    ) {
      try {
        return new URL(href, baseUrl).href;
      } catch {
        continue;
      }
    }
  }
  return null;
}

async function fetchHtml(
  url: string,
  fetchFn: FetchLike,
): Promise<{ html: string | null; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ENRICH_TIMEOUT_MS);
  try {
    const res = await fetchFn(url, {
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "hk-leaders-operator-filter/1.0",
      },
      redirect: "follow",
    });
    if (!res.ok) return { html: null, error: `http_${res.status}` };
    const reader = res.body?.getReader();
    if (!reader) return { html: null, error: "empty_body" };
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.length;
        if (total > ENRICH_MAX_BYTES) {
          await reader.cancel();
          break;
        }
        chunks.push(value);
      }
    }
    const buf = Buffer.concat(chunks);
    return { html: buf.toString("utf8") };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch_failed";
    return { html: null, error: msg };
  } finally {
    clearTimeout(timer);
  }
}

function parsePageSignals(html: string, pageUrl: string): {
  pageTitle: string | null;
  metaDescription: string | null;
  h1: string | null;
  organizationName: string | null;
  organizationTypes: string[];
  contactHints: string[];
  aboutPageUrl: string | null;
} {
  const pageTitle =
    firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i)?.replace(/\s+/g, " ") ??
    null;
  const metaDescription =
    firstMatch(
      html,
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i,
    ) ??
    firstMatch(
      html,
      /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i,
    );
  const h1Raw = firstMatch(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const h1 = h1Raw ? stripTags(h1Raw).slice(0, 500) : null;

  const org = { name: undefined as string | undefined, types: new Set<string>() };
  for (const block of extractJsonLdBlocks(html)) collectOrganizations(block, org);

  const contactHints: string[] = [];
  const email = html.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i)?.[0];
  if (email) contactHints.push(`email:${email}`);
  if (/whatsapp|wa\.me/i.test(html)) contactHints.push("whatsapp");
  if (/預約|预约|book now|contact us|聯絡|联络/i.test(html)) {
    contactHints.push("contact_cta");
  }

  return {
    pageTitle,
    metaDescription,
    h1,
    organizationName: org.name ?? null,
    organizationTypes: [...org.types],
    contactHints,
    aboutPageUrl: findAboutLink(html, pageUrl),
  };
}

export async function enrichDomain(
  candidate: ClassificationCandidate,
  fetchFn: FetchLike = DEFAULT_FETCH,
): Promise<DomainEnrichmentSignals> {
  const domain = normalizeDomain(candidate.domain);
  const homepageUrl = candidate.bestUrl?.trim()
    ? candidate.bestUrl
    : `https://${domain}/`;
  const base: DomainEnrichmentSignals = {
    domain,
    homepageUrl,
    pageTitle: candidate.bestTitle,
    metaDescription: null,
    h1: null,
    organizationName: null,
    organizationTypes: [],
    contactHints: [],
    aboutPageUrl: null,
    aboutSnippet: null,
    fetchErrors: [],
  };

  if (!enrichmentEnabled()) return base;

  const home = await fetchHtml(homepageUrl, fetchFn);
  if (home.error) base.fetchErrors.push(`homepage:${home.error}`);
  if (!home.html) return base;

  const homeSignals = parsePageSignals(home.html, homepageUrl);
  Object.assign(base, homeSignals);

  if (homeSignals.aboutPageUrl && homeSignals.aboutPageUrl !== homepageUrl) {
    const about = await fetchHtml(homeSignals.aboutPageUrl, fetchFn);
    if (about.error) base.fetchErrors.push(`about:${about.error}`);
    if (about.html) {
      const snippet = stripTags(about.html).slice(0, 1200);
      base.aboutSnippet = snippet || null;
    }
  }

  return base;
}
