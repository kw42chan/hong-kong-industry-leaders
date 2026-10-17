import "server-only";
import { and, eq, inArray, ne, notInArray } from "drizzle-orm";
import { getDb, schema } from "../db";
import type { LeadersJson, SearchQuery } from "../db/schema";
import { applyOperatorFilter } from "../classification/filter";
import { loadClassificationCache, saveClassificationCache } from "../classification/cache";
import { computeLeaders } from "../ranking/leaders";
import { parseSerp } from "./parse";
import { queryIdFromTag } from "./tasks";

const { searches, searchQueries, serpSnapshots, results } = schema;

const STATUS_OK = 20000;

/** Minimal shape of one entry in a DataForSEO `tasks[]` array. */
export interface RawTask {
  id?: unknown;
  status_code?: unknown;
  status_message?: unknown;
  data?: { tag?: unknown } | null;
  result?: unknown[] | null;
}

export type IngestOutcome =
  | { kind: "stored"; searchId: string }
  | { kind: "failed"; searchId: string }
  | { kind: "duplicate"; searchId: string }
  | { kind: "unknown" };

async function findQuery(task: RawTask): Promise<SearchQuery | undefined> {
  const db = getDb();
  if (typeof task.id === "string") {
    const [byTask] = await db
      .select()
      .from(searchQueries)
      .where(eq(searchQueries.dataforseoTaskId, task.id))
      .limit(1);
    if (byTask) return byTask;
  }
  const queryId = queryIdFromTag(task.data?.tag);
  if (queryId) {
    const [byTag] = await db
      .select()
      .from(searchQueries)
      .where(eq(searchQueries.id, queryId))
      .limit(1);
    return byTag;
  }
  return undefined;
}

/**
 * Stores one finished DataForSEO task (from a postback or task_get): raw and
 * parsed snapshot, query marked `ready`; or query marked `failed` on a task
 * error. Idempotent: a query already `ready` is left untouched.
 */
export async function ingestTask(task: RawTask): Promise<IngestOutcome> {
  const query = await findQuery(task);
  if (!query) return { kind: "unknown" };
  const { searchId } = query;
  if (query.status === "ready") return { kind: "duplicate", searchId };

  const db = getDb();
  const taskId = typeof task.id === "string" ? task.id : query.dataforseoTaskId;

  if (task.status_code !== STATUS_OK) {
    await db
      .update(searchQueries)
      .set({ status: "failed", dataforseoTaskId: taskId })
      .where(and(eq(searchQueries.id, query.id), ne(searchQueries.status, "ready")));
    return { kind: "failed", searchId };
  }

  const parsed = parseSerp(task.result?.[0]);
  const stored = await db.transaction(async (tx) => {
    const claimed = await tx
      .update(searchQueries)
      .set({ status: "ready", dataforseoTaskId: taskId })
      .where(and(eq(searchQueries.id, query.id), ne(searchQueries.status, "ready")))
      .returning({ id: searchQueries.id });
    if (!claimed.length) return false;
    await tx
      .insert(serpSnapshots)
      .values({ queryId: query.id, rawJson: task, parsedJson: parsed });
    return true;
  });
  return stored ? { kind: "stored", searchId } : { kind: "duplicate", searchId };
}

/**
 * Once no query of the search is still pending/posted, computes leaders from
 * the stored snapshots and marks the search `ready` (or `failed` if every
 * query failed). Safe to call repeatedly and concurrently.
 */
export async function finalizeSearch(
  searchId: string,
): Promise<"running" | "ready" | "failed"> {
  const db = getDb();
  const queries = await db
    .select({ status: searchQueries.status })
    .from(searchQueries)
    .where(eq(searchQueries.searchId, searchId));

  if (queries.some((q) => q.status === "pending" || q.status === "posted")) {
    return "running";
  }

  if (!queries.some((q) => q.status === "ready")) {
    await db
      .update(searches)
      .set({ status: "failed" })
      .where(and(eq(searches.id, searchId), notInArray(searches.status, ["ready", "failed"])));
    return "failed";
  }

  const [searchRow] = await db
    .select({ keyword: searches.keyword })
    .from(searches)
    .where(eq(searches.id, searchId))
    .limit(1);

  const rows = await db
    .select({ queryText: searchQueries.queryText, parsed: serpSnapshots.parsedJson })
    .from(serpSnapshots)
    .innerJoin(searchQueries, eq(serpSnapshots.queryId, searchQueries.id))
    .where(and(eq(searchQueries.searchId, searchId), eq(searchQueries.status, "ready")));

  const snapshots = rows.flatMap((r) =>
    r.parsed ? [{ queryText: r.queryText, parsed: r.parsed }] : [],
  );
  const ranked = computeLeaders(snapshots);
  const filtered = await applyOperatorFilter(
    searchRow?.keyword ?? "",
    ranked,
    ranked.classificationCandidates,
    { loadCache: loadClassificationCache, saveCache: saveClassificationCache },
  );
  const leadersJson: LeadersJson = {
    leaders: filtered.leaders,
    citedSources: filtered.citedSources,
  };

  await db.transaction(async (tx) => {
    await tx.insert(results).values({ searchId, leadersJson }).onConflictDoNothing();
    await tx
      .update(searches)
      .set({ status: "ready" })
      .where(and(eq(searches.id, searchId), inArray(searches.status, ["queued", "running"])));
  });
  return "ready";
}
