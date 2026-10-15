import { asc, desc, eq, inArray } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getMockResult, isMockEnabled, MOCK_TOKEN } from "@/components/search/mock-result";
import { getDb, schema } from "@/lib/db";
import type { SearchQuerySummary, SearchResultDTO } from "@/lib/types";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

const noStore = { "Cache-Control": "no-store" };

function notFound() {
  return Response.json({ error: "not_found" }, { status: 404, headers: noStore });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  if (isMockEnabled()) {
    const mock = request.nextUrl.searchParams.get("mock");
    if (mock || token === MOCK_TOKEN) {
      const dto: SearchResultDTO = { ...getMockResult(mock ?? "ready"), token };
      return Response.json(dto, { headers: noStore });
    }
  }

  if (!TOKEN_PATTERN.test(token)) return notFound();

  const db = getDb();
  const { searches, searchQueries, serpSnapshots, results } = schema;

  const [search] = await db
    .select()
    .from(searches)
    .where(eq(searches.token, token))
    .limit(1);
  if (!search) return notFound();

  const queryRows = await db
    .select({ id: searchQueries.id, text: searchQueries.queryText })
    .from(searchQueries)
    .where(eq(searchQueries.searchId, search.id))
    .orderBy(asc(searchQueries.createdAt));

  const aioByQuery = new Map<string, boolean>();
  if (queryRows.length > 0) {
    const snapshots = await db
      .select({ queryId: serpSnapshots.queryId, parsed: serpSnapshots.parsedJson })
      .from(serpSnapshots)
      .where(inArray(serpSnapshots.queryId, queryRows.map((q) => q.id)))
      .orderBy(desc(serpSnapshots.createdAt));
    for (const snap of snapshots) {
      if (!aioByQuery.has(snap.queryId) && snap.parsed) {
        aioByQuery.set(snap.queryId, snap.parsed.aiOverviewPresent);
      }
    }
  }

  const queries: SearchQuerySummary[] = queryRows.map((q) => ({
    text: q.text,
    aiOverviewPresent: aioByQuery.get(q.id) ?? false,
  }));

  const dto: SearchResultDTO = {
    token: search.token,
    keyword: search.keyword,
    status: search.status,
    leaders: [],
    citedSources: [],
    queries,
    scrapedAt: null,
  };

  if (search.status === "ready") {
    const [result] = await db
      .select()
      .from(results)
      .where(eq(results.searchId, search.id))
      .limit(1);
    if (result) {
      dto.leaders = result.leadersJson.leaders;
      dto.citedSources = result.leadersJson.citedSources;
      dto.scrapedAt = result.createdAt.toISOString();
    }
  }

  return Response.json(dto, { headers: noStore });
}
