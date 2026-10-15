import "server-only";
import { gunzipSync } from "node:zlib";
import type { NextRequest } from "next/server";
import { secretsMatch } from "@/lib/dataforseo/auth";
import { finalizeSearch, ingestTask, type RawTask } from "@/lib/dataforseo/ingest";

/** DataForSEO postbacks are gzip-compressed, with or without a Content-Encoding header. */
function decodeBody(buf: Buffer): string {
  const gzipped = buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b;
  return (gzipped ? gunzipSync(buf) : buf).toString("utf8");
}

export async function POST(request: NextRequest) {
  if (!secretsMatch(request.nextUrl.searchParams.get("secret"), process.env.POSTBACK_SECRET)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: { tasks?: RawTask[] | null };
  try {
    payload = JSON.parse(decodeBody(Buffer.from(await request.arrayBuffer())));
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const tasks = Array.isArray(payload?.tasks) ? payload.tasks : [];
  const searchIds = new Set<string>();
  let unknown = 0;
  for (const task of tasks) {
    const outcome = await ingestTask(task);
    if (outcome.kind === "unknown") unknown++;
    else searchIds.add(outcome.searchId);
  }

  for (const searchId of searchIds) {
    await finalizeSearch(searchId);
  }

  if (unknown) console.warn(`DataForSEO postback: ${unknown} task(s) matched no query`);
  return Response.json({ ok: true, tasks: tasks.length, unknown });
}
