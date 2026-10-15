import "server-only";
import { dataForSeoFetch, type DataForSeoTask } from "./client";

/** Hong Kong; confirm via `/v3/serp/google/locations/hk`. */
export const HK_LOCATION_CODE = 2344;
export const SERP_LANGUAGE_CODE = "zh-TW";
/** Only the organic top 10 is used, and DataForSEO bills per 10 results. */
export const SERP_DEPTH = 10;

/** DataForSEO caps a single task_post request at 100 tasks. */
const MAX_TASKS_PER_POST = 100;

const STATUS_OK = 20000;
const STATUS_TASK_CREATED = 20100;
const STATUS_TASK_HANDED = 40601;
const STATUS_TASK_IN_QUEUE = 40602;

export interface QueryToPost {
  id: string;
  text: string;
}

export type PostedTask =
  | { queryId: string; ok: true; taskId: string }
  | { queryId: string; ok: false; error: string };

/** Per-task tag: `${tag}:${queryId}`, so a postback can be matched without the task id. */
export function buildTaskTag(tag: string, queryId: string): string {
  return `${tag}:${queryId}`;
}

/** Inverse of {@link buildTaskTag}; returns the query id or null. */
export function queryIdFromTag(tag: unknown): string | null {
  if (typeof tag !== "string") return null;
  const id = tag.slice(tag.lastIndexOf(":") + 1);
  return /^[0-9a-f-]{36}$/i.test(id) ? id : null;
}

/**
 * Queues one Standard Google Organic task per query. Results arrive at
 * `postbackUrl` as Advanced JSON; `getTaskAdvanced` is the fallback.
 */
export async function postTasks(
  queries: QueryToPost[],
  tag: string,
  postbackUrl: string,
): Promise<PostedTask[]> {
  const out: PostedTask[] = [];
  for (let i = 0; i < queries.length; i += MAX_TASKS_PER_POST) {
    const batch = queries.slice(i, i + MAX_TASKS_PER_POST);
    const body = batch.map((q) => ({
      keyword: q.text,
      location_code: HK_LOCATION_CODE,
      language_code: SERP_LANGUAGE_CODE,
      device: "mobile",
      depth: SERP_DEPTH,
      load_async_ai_overview: true,
      tag: buildTaskTag(tag, q.id),
      postback_url: postbackUrl,
      postback_data: "advanced",
    }));

    const json = await dataForSeoFetch("/serp/google/organic/task_post", {
      method: "POST",
      body,
    });

    // Tasks come back in request order.
    batch.forEach((q, idx) => {
      const task = json.tasks?.[idx];
      if (task && task.status_code === STATUS_TASK_CREATED && task.id) {
        out.push({ queryId: q.id, ok: true, taskId: task.id });
      } else {
        out.push({
          queryId: q.id,
          ok: false,
          error: task
            ? `${task.status_code}: ${task.status_message}`
            : "missing task in response",
        });
      }
    });
  }
  return out;
}

export type TaskGetOutcome =
  | { status: "ready"; task: DataForSeoTask }
  | { status: "pending" }
  | { status: "failed"; error: string; task: DataForSeoTask | null };

/** Fetches a finished task's Advanced result; `pending` while still queued. */
export async function getTaskAdvanced(id: string): Promise<TaskGetOutcome> {
  const json = await dataForSeoFetch(
    `/serp/google/organic/task_get/advanced/${encodeURIComponent(id)}`,
  );
  const task = json.tasks?.[0] ?? null;
  if (!task) return { status: "failed", error: "missing task in response", task };
  if (task.status_code === STATUS_OK) return { status: "ready", task };
  if (
    task.status_code === STATUS_TASK_HANDED ||
    task.status_code === STATUS_TASK_IN_QUEUE
  ) {
    return { status: "pending" };
  }
  return {
    status: "failed",
    error: `${task.status_code}: ${task.status_message}`,
    task,
  };
}
