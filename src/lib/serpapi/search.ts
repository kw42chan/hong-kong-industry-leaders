import "server-only";
import type { ParsedSerp } from "../types";
import { aiOverviewPageToken, parseSerpApi, withAiOverview } from "./parse";

const ENDPOINT = "https://serpapi.com/search.json";
const CJK_RE = /[\u3400-\u9fff\uf900-\ufaff]/;

export interface GoogleSerp {
  id: string | null;
  raw: unknown;
  parsed: ParsedSerp;
}

function redact(text: string): string {
  return text.replace(/api_key=[^&\s"]+/gi, "api_key=redacted");
}

async function getJson(params: URLSearchParams): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(`${ENDPOINT}?${params}`, { signal: AbortSignal.timeout(20_000) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "request failed";
    throw new Error(`SerpAPI request failed: ${redact(message)}`);
  }
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`SerpAPI HTTP ${res.status}: ${redact(text).slice(0, 300)}`);
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("SerpAPI returned invalid JSON");
  }
  const status =
    typeof json === "object" && json !== null && "search_metadata" in json
      ? (json as { search_metadata?: { status?: unknown } }).search_metadata?.status
      : undefined;
  if (typeof status === "string" && status !== "Success") {
    const error =
      typeof json === "object" && json !== null && "error" in json
        ? String((json as { error?: unknown }).error ?? "")
        : status;
    throw new Error(`SerpAPI ${redact(error || status)}`);
  }
  return json;
}

/** One Google Hong Kong search, plus an immediate AI Overview fetch when a token is returned. */
export async function fetchGoogleSerp(query: string): Promise<GoogleSerp> {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) throw new Error("SERPAPI_API_KEY must be set");

  const params = new URLSearchParams({
    engine: "google",
    q: query,
    api_key: apiKey,
    location: "Hong Kong",
    gl: "hk",
    google_domain: "google.com.hk",
    device: "mobile",
    hl: CJK_RE.test(query) ? "zh-tw" : "en",
    num: "10",
  });
  let raw = await getJson(params);
  const token = aiOverviewPageToken(raw);
  if (token) {
    const overview = await getJson(
      new URLSearchParams({
        engine: "google_ai_overview",
        page_token: token,
        api_key: apiKey,
      }),
    );
    raw = withAiOverview(raw, overview);
  }
  const id =
    typeof raw === "object" && raw !== null && "search_metadata" in raw
      ? ((raw as { search_metadata?: { id?: unknown } }).search_metadata?.id ?? null)
      : null;
  return {
    id: typeof id === "string" ? id : null,
    raw,
    parsed: parseSerpApi(raw),
  };
}
