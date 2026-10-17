export const SEARCH_START_LIMIT = 5;
export const SEARCH_START_WINDOW_MS = 10 * 60 * 1000;

type TimestampMs = number;

/** In-memory successful search starts per client IP (single Node process). */
const globalStarts = new Map<string, TimestampMs[]>();

function prune(timestamps: TimestampMs[], now: TimestampMs, windowMs: number): TimestampMs[] {
  const cutoff = now - windowMs;
  return timestamps.filter((t) => t > cutoff);
}

export type SearchStartRateLimit = {
  canStartSearch(ip: string, at?: TimestampMs): boolean;
  noteSearchStarted(ip: string, at?: TimestampMs): void;
  /** @internal Test helper — clears all recorded starts. */
  _resetForTests(): void;
};

function createSearchStartRateLimit(
  store: Map<string, TimestampMs[]>,
  limit = SEARCH_START_LIMIT,
  windowMs = SEARCH_START_WINDOW_MS,
): SearchStartRateLimit {
  return {
    canStartSearch(ip, at = Date.now()) {
      const recent = prune(store.get(ip) ?? [], at, windowMs);
      return recent.length < limit;
    },
    noteSearchStarted(ip, at = Date.now()) {
      const recent = prune(store.get(ip) ?? [], at, windowMs);
      recent.push(at);
      store.set(ip, recent);
    },
    _resetForTests() {
      store.clear();
    },
  };
}

/** Production limiter shared by the searches API route. */
export const searchStartRateLimit = createSearchStartRateLimit(globalStarts);
