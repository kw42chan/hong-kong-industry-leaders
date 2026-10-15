import "server-only";

export const MAX_KEYWORD_LENGTH = 60;

const CJK_RE = /[\u3400-\u9fff\uf900-\ufaff]/;
const CONTROL_RE = /[\u0000-\u001f\u007f]/g;

/** Trims, strips control characters and collapses whitespace. */
export function normalizeKeyword(keyword: string): string {
  return keyword.replace(CONTROL_RE, " ").replace(/\s+/g, " ").trim();
}

/** Returns an error code for an invalid keyword, or null if it is acceptable. */
export function validateKeyword(
  keyword: unknown,
): "missing" | "too_long" | null {
  if (typeof keyword !== "string") return "missing";
  const normalized = normalizeKeyword(keyword);
  if (!normalized) return "missing";
  if ([...normalized].length > MAX_KEYWORD_LENGTH) return "too_long";
  return null;
}

type Template = (k: string) => string;

// Chinese templates for a CJK keyword: no spaces, as people type them.
const ZH_TEMPLATES: Template[] = [
  (k) => `香港${k}推薦`,
  (k) => `邊間${k}好`,
  (k) => `最好嘅${k}香港`,
  (k) => `${k}比較`,
  (k) => `香港${k}邊間好`,
  (k) => `香港十大${k}`,
];

// Chinese templates for a Latin-script keyword: spaces around the keyword.
const ZH_TEMPLATES_SPACED: Template[] = [
  (k) => `香港 ${k} 推薦`,
  (k) => `邊間 ${k} 好`,
  (k) => `最好嘅 ${k} 香港`,
  (k) => `${k} 比較`,
  (k) => `香港 ${k} 邊間好`,
];

const EN_TEMPLATES: Template[] = [
  (k) => `best ${k} Hong Kong`,
  (k) => `top ${k} in Hong Kong`,
  (k) => `recommended ${k} Hong Kong`,
  (k) => `${k} Hong Kong comparison`,
  (k) => `which ${k} is best in Hong Kong`,
];

/**
 * Builds 6–8 Hong Kong recommendation-style search queries for an industry
 * keyword. The keyword's script picks the template set; for Latin-script
 * keywords the UI locale decides whether Chinese or English phrasing leads.
 */
export function generateQueries(keyword: string, locale: string): string[] {
  const k = normalizeKeyword(keyword);
  if (!k) throw new Error("keyword is empty");

  let templates: Template[];
  if (CJK_RE.test(k)) {
    templates = [...ZH_TEMPLATES, EN_TEMPLATES[0]];
  } else if (locale === "en") {
    templates = [...EN_TEMPLATES, ZH_TEMPLATES_SPACED[0], ZH_TEMPLATES_SPACED[1]];
  } else {
    templates = [...ZH_TEMPLATES_SPACED, EN_TEMPLATES[0], EN_TEMPLATES[1]];
  }

  const seen = new Set<string>();
  const queries: string[] = [];
  for (const t of templates) {
    const q = t(k);
    const key = q.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      queries.push(q);
    }
  }
  return queries;
}
