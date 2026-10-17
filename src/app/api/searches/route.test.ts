import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { fetchGoogleSerp, afterTasks } = vi.hoisted(() => ({
  afterTasks: [] as Promise<unknown>[],
  fetchGoogleSerp: vi.fn(async () => ({
    id: "serp-1",
    raw: {},
    parsed: {
      aiOverviewPresent: false,
      aiOverviewText: null,
      aioReferences: [],
      organic: [],
    },
  })),
}));

vi.mock("@/lib/serpapi/search", () => ({
  fetchGoogleSerp,
}));

vi.mock("next/server", () => ({
  after: (task: () => Promise<void>) => {
    afterTasks.push(Promise.resolve().then(task));
  },
}));

vi.mock("@/lib/dataforseo/ingest", () => ({
  finalizeSearch: vi.fn(async () => "running"),
}));

const searches = { id: "searches" };
const searchQueries = { id: "id", status: "status", queryText: "queryText" };
const serpSnapshots = { id: "snapshots" };

function insertValues(table: unknown, vals: unknown) {
  const rows =
    table === searches
      ? [{ id: "search-1" }]
      : (Array.isArray(vals) ? vals : [vals]).map((row: { queryText?: string }, i: number) => ({
          id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
          text: row.queryText ?? "q",
        }));
  const pending = Promise.resolve(rows);
  return Object.assign(pending, { returning: () => pending });
}

vi.mock("@/lib/db", () => ({
  schema: { searches, searchQueries, serpSnapshots },
  getDb: () => ({
    insert: (table: unknown) => ({
      values: (vals: unknown) => insertValues(table, vals),
    }),
    transaction: async (fn: (tx: {
      insert: (table: unknown) => {
        values: (vals: unknown) => { returning: () => Promise<unknown[]> };
      };
    }) => Promise<unknown>) =>
      fn({
        insert: (table: unknown) => ({
          values: (vals: unknown) => insertValues(table, vals),
        }),
      }),
    update: () => ({
      set: () => ({
        where: () => Promise.resolve([]),
      }),
    }),
  }),
}));

const { searchStartRateLimit } = await import("@/lib/rate-limit/search-starts");
const { POST } = await import("./route");

const WINDOW_MS = 10 * 60 * 1000;
const t0 = Date.parse("2026-10-16T08:00:00.000Z");

async function start(ip: string, body: unknown = { keyword: "會計師", locale: "zh-HK" }) {
  const response = await POST(
    new Request("http://localhost/api/searches", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": ip,
      },
      body: JSON.stringify(body),
    }),
  );
  await Promise.all(afterTasks.splice(0));
  return response;
}

beforeEach(() => {
  searchStartRateLimit._resetForTests();
  fetchGoogleSerp.mockClear();
  vi.spyOn(Date, "now").mockReturnValue(t0);
});

describe("POST /api/searches", () => {
  it("allows 5 searches from one IP in 10 minutes and refuses the 6th without calling SerpAPI", async () => {
    const ip = "203.0.113.10";

    for (let i = 0; i < 5; i++) {
      const res = await start(ip);
      expect(res.status).toBe(201);
    }
    const callsAfterFive = fetchGoogleSerp.mock.calls.length;

    const limited = await start(ip);
    expect(limited.status).toBe(429);
    expect(fetchGoogleSerp.mock.calls.length).toBe(callsAfterFive);
    await expect(limited.json()).resolves.toEqual({ error: "rate_limited" });
  });

  it("does not count an invalid keyword or locale toward the limit", async () => {
    const ip = "203.0.113.20";

    for (let i = 0; i < 5; i++) {
      const missing = await start(ip, { keyword: "   ", locale: "zh-HK" });
      expect(missing.status).toBe(400);
      const badLocale = await start(ip, { keyword: "牙醫", locale: "fr" });
      expect(badLocale.status).toBe(400);
    }
    expect(fetchGoogleSerp).not.toHaveBeenCalled();

    const created = await start(ip, { keyword: "牙醫", locale: "zh-HK" });
    expect(created.status).toBe(201);
  });

  it("allows another IP while the first is limited", async () => {
    const limitedIp = "203.0.113.30";
    for (let i = 0; i < 5; i++) {
      expect((await start(limitedIp)).status).toBe(201);
    }
    expect((await start(limitedIp)).status).toBe(429);

    const other = await start("203.0.113.31");
    expect(other.status).toBe(201);
  });

  it("allows the same IP again once the 10 minute window has passed", async () => {
    const ip = "203.0.113.40";
    for (let i = 0; i < 5; i++) {
      expect((await start(ip)).status).toBe(201);
    }
    vi.spyOn(Date, "now").mockReturnValue(t0 + WINDOW_MS - 1);
    expect((await start(ip)).status).toBe(429);

    vi.spyOn(Date, "now").mockReturnValue(t0 + WINDOW_MS);
    expect((await start(ip)).status).toBe(201);
  });
});
