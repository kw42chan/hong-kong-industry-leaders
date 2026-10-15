import "server-only";
import { and, asc, eq, isNotNull, lt } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { secretsMatch } from "@/lib/dataforseo/auth";
import { finalizeSearch, ingestTask } from "@/lib/dataforseo/ingest";
import { getTaskAdvanced } from "@/lib/dataforseo/tasks";

const { searchQueries } = schema;

/** Give the postback a head start before polling a task. Override with RECONCILE_MIN_AGE_MS (e.g. 0 locally). */
const DEFAULT_MIN_AGE_MS = 2 * 60 * 1000;
const BATCH_SIZE = 50;

function minAgeMs(): number {
  const raw = process.env.RECONCILE_MIN_AGE_MS;
  if (raw === undefined || raw === "") return DEFAULT_MIN_AGE_MS;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_MIN_AGE_MS;
}

function bearer(request: Request): string | null {
  const header = request.headers.get("authorization");
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

export async function GET(request: Request) {
  if (!secretsMatch(bearer(request), process.env.CRON_SECRET)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const ageMs = minAgeMs();
  const filters = [
    eq(searchQueries.status, "posted"),
    isNotNull(searchQueries.dataforseoTaskId),
  ];
  if (ageMs > 0) {
    filters.push(lt(searchQueries.updatedAt, new Date(Date.now() - ageMs)));
  }
  const pending = await db
    .select({
      id: searchQueries.id,
      searchId: searchQueries.searchId,
      taskId: searchQueries.dataforseoTaskId,
    })
    .from(searchQueries)
    .where(and(...filters))
    .orderBy(asc(searchQueries.updatedAt))
    .limit(BATCH_SIZE);

  const counts = { checked: pending.length, ready: 0, failed: 0, pending: 0, errors: 0 };
  const searchIds = new Set<string>();

  for (const q of pending) {
    try {
      const outcome = await getTaskAdvanced(q.taskId!);
      if (outcome.status === "pending") {
        counts.pending++;
        continue;
      }
      if (outcome.status === "ready") {
        await ingestTask(outcome.task);
        counts.ready++;
      } else {
        await ingestTask(outcome.task ?? { id: q.taskId, status_code: 0, data: null, result: null });
        counts.failed++;
      }
      searchIds.add(q.searchId);
    } catch (err) {
      counts.errors++;
      console.error(`Reconcile failed for task ${q.taskId}`, err);
    }
  }

  for (const searchId of searchIds) {
    await finalizeSearch(searchId);
  }

  return Response.json(counts);
}
