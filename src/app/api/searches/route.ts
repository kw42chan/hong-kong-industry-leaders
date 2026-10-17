import "server-only";
import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { buildPostbackUrl } from "@/lib/dataforseo/auth";
import { finalizeSearch } from "@/lib/dataforseo/ingest";
import { postTasks } from "@/lib/dataforseo/tasks";
import {
  generateQueries,
  normalizeKeyword,
  validateKeyword,
} from "@/lib/queries/generate";
import { routing } from "@/i18n/routing";
import { getClientIp } from "@/lib/rate-limit/client-ip";
import { searchStartRateLimit } from "@/lib/rate-limit/search-starts";

const { searches, searchQueries } = schema;

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

  const clientIp = getClientIp(request);
  if (!searchStartRateLimit.canStartSearch(clientIp)) {
    return tooManyRequests();
  }

  const postbackUrl = buildPostbackUrl();
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

  let posted;
  try {
    posted = await postTasks(queries, searchId, postbackUrl);
  } catch (err) {
    console.error("DataForSEO task_post failed", err);
    await db.update(searches).set({ status: "failed" }).where(eq(searches.id, searchId));
    return Response.json({ error: "upstream_failed" }, { status: 502 });
  }

  // Only touch rows still `pending`: a fast postback may already have marked one `ready`.
  await Promise.all(
    posted.map((p) =>
      db
        .update(searchQueries)
        .set(p.ok ? { status: "posted", dataforseoTaskId: p.taskId } : { status: "failed" })
        .where(and(eq(searchQueries.id, p.queryId), eq(searchQueries.status, "pending"))),
    ),
  );

  const failed = posted.filter((p) => !p.ok);
  if (failed.length) console.error("DataForSEO rejected tasks", failed);

  if (failed.length === posted.length) {
    await db.update(searches).set({ status: "failed" }).where(eq(searches.id, searchId));
    return Response.json({ error: "upstream_failed" }, { status: 502 });
  }

  await db
    .update(searches)
    .set({ status: "running" })
    .where(and(eq(searches.id, searchId), eq(searches.status, "queued")));
  // Postbacks that landed before the statuses above were written could not finalize.
  await finalizeSearch(searchId);

  searchStartRateLimit.noteSearchStarted(clientIp);
  return Response.json({ token }, { status: 201 });
}
