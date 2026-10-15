import "server-only";

export const DEFAULT_DATAFORSEO_BASE_URL = "https://sandbox.dataforseo.com/v3";

/** Common envelope returned by every DataForSEO v3 endpoint. */
export interface DataForSeoResponse<TResult = unknown> {
  version: string;
  status_code: number;
  status_message: string;
  time: string;
  cost: number;
  tasks_count: number;
  tasks_error: number;
  tasks: DataForSeoTask<TResult>[] | null;
}

export interface DataForSeoTask<TResult = unknown> {
  id: string;
  status_code: number;
  status_message: string;
  time: string;
  cost: number;
  result_count: number;
  path: string[];
  data: Record<string, unknown>;
  result: TResult[] | null;
}

export interface UserDataResult {
  login: string;
  timezone: string;
  rates: unknown;
  money: {
    total: number;
    balance: number;
    limits: unknown;
    statistics: unknown;
  };
  price: unknown;
}

export class DataForSeoError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number,
    readonly statusCode?: number,
  ) {
    super(message);
    this.name = "DataForSeoError";
  }
}

interface DataForSeoConfig {
  login: string;
  password: string;
  baseUrl: string;
}

function getConfig(): DataForSeoConfig {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!login || !password) {
    throw new Error("DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD must be set");
  }
  const baseUrl = (
    process.env.DATAFORSEO_BASE_URL || DEFAULT_DATAFORSEO_BASE_URL
  ).replace(/\/+$/, "");
  return { login, password, baseUrl };
}

/**
 * Authenticated request to the DataForSEO v3 API.
 * `path` is relative to the base URL, e.g. `/appendix/user_data`.
 * Throws on HTTP errors and on non-20000 envelope status codes.
 */
export async function dataForSeoFetch<TResult = unknown>(
  path: string,
  init: { method?: "GET" | "POST"; body?: unknown } = {},
): Promise<DataForSeoResponse<TResult>> {
  const { login, password, baseUrl } = getConfig();
  const auth = Buffer.from(`${login}:${password}`).toString("base64");

  const res = await fetch(`${baseUrl}${path.startsWith("/") ? "" : "/"}${path}`, {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"),
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new DataForSeoError(
      `DataForSEO HTTP ${res.status} for ${path}: ${text.slice(0, 500)}`,
      res.status,
    );
  }

  const json = (await res.json()) as DataForSeoResponse<TResult>;
  if (json.status_code !== 20000) {
    throw new DataForSeoError(
      `DataForSEO error ${json.status_code}: ${json.status_message}`,
      res.status,
      json.status_code,
    );
  }
  return json;
}

/** Verifies credentials and returns account info (balance, limits). */
export async function pingUserData(): Promise<UserDataResult> {
  const json = await dataForSeoFetch<UserDataResult>("/appendix/user_data");
  const result = json.tasks?.[0]?.result?.[0];
  if (!result) {
    throw new DataForSeoError("DataForSEO user_data returned no result", 200);
  }
  return result;
}
