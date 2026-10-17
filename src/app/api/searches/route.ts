import "server-only";
import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { after } from "next/server";
import { getDb, schema } from "@/lib/db";
import { finalizeSearch } from "@/lib/dataforseo/ingest";
import { fetchGoogleSerp } from "@/lib/serpapi/search";
import {
  generateQueries,
  normalizeKeyword,
  validateKeyword,
} from "@/lib/queries/generate";
import { routing } from "@/i18n/routing";
import { getClientIp } from "@/lib/rate-limit/client-ip";
import { searchStartRateLimit } from "@/lib/rate-limit/search-starts";

const { searches, searchQueries, serpSnapshots } = schema;

function badRequest(error: string) {
  return Response.json({ error }, { status: 400 });
}

function tooManyRequests() {
  return Response.json({ error: "rate_limited" }, { status: 429 });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("invalid_json");
  }
  if (typeof body !== "object" || body === null) return badRequest("invalid_body");
  const { keyword: rawKeyword, locale: rawLocale } = body as Record<string, unknown>;

  const keywordError = validateKeyword(rawKeyword);
  if (keywordError) return badRequest(`keyword_${keywordError}`);
  const keyword = normalizeKeyword(rawKeyword as string);

  const locale =
    rawLocale === undefined ? routing.defaultLocale : rawLocale;
  if (typeof locale !== "string" || !(routing.locales as readonly string[]).includes(locale)) {
    return badRequest("invalid_locale");
  }

  const ip = getClientIp(request);
  if (!searchStartRateLimit.canStartSearch(ip)) {
    return tooManyRequests();
  }

  const queryTexts = generateQueries(keyword, locale);
  const token = randomBytes(24).toString("base64url");
  const db = getDb();

  const { searchId, queries } = await db.transaction(async (tx) => {
    const [search] = await tx
      .insert(searches)
      .values({ token, keyword, locale, status: "queued" })
      .returning({ id: searches.id });
    const queries = await tx
      .insert(searchQueries)
      .values(queryTexts.map((queryText) => ({ searchId: search.id, queryText })))
      .returning({ id: searchQueries.id, text: searchQueries.queryText });
    return { searchId: search.id, queries };
  });

  await db
    .update(searches)
    .set({ status: "running" })
    .where(and(eq(searches.id, searchId), eq(searches.status, "queued")));

  after(async () => {
    await Promise.all(
      queries.map(async (query) => {
        try {
          const snap = await fetchGoogleSerp(query.text);
          await db.insert(serpSnapshots).values({
            queryId: query.id,
            rawJson: snap.raw,
            parsedJson: snap.parsed,
          });
          await db
            .update(searchQueries)
            .set({ status: "ready" })
            .where(eq(searchQueries.id, query.id));
        } catch (err) {
          console.error(
            "SerpAPI search failed",
            err instanceof Error ? err.message : "unknown error",
          );
          await db
            .update(searchQueries)
            .set({ status: "failed" })
            .where(eq(searchQueries.id, query.id));
        }
      }),
    );
    await finalizeSearch(searchId);
  });

  searchStartRateLimit.noteSearchStarted(ip);
  return Response.json({ token }, { status: 201 });
}
