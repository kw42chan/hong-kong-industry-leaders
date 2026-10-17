import { beforeEach, describe, expect, it } from "vitest";
import {
  SEARCH_START_LIMIT,
  SEARCH_START_WINDOW_MS,
  searchStartRateLimit,
} from "./search-starts";

describe("search start rate limit", () => {
  const ip = "203.0.113.10";
  const t0 = 1_700_000_000_000;

  beforeEach(() => {
    searchStartRateLimit._resetForTests();
  });

  it(`allows ${SEARCH_START_LIMIT} starts per IP per window, then blocks the next`, () => {
    for (let i = 0; i < SEARCH_START_LIMIT; i++) {
      expect(searchStartRateLimit.canStartSearch(ip, t0 + i)).toBe(true);
      searchStartRateLimit.noteSearchStarted(ip, t0 + i);
    }
    expect(searchStartRateLimit.canStartSearch(ip, t0 + SEARCH_START_LIMIT)).toBe(false);
  });

  it("does not count starts from other IPs toward the limit", () => {
    for (let i = 0; i < SEARCH_START_LIMIT; i++) {
      searchStartRateLimit.noteSearchStarted(ip, t0 + i);
    }
    expect(searchStartRateLimit.canStartSearch("203.0.113.11", t0)).toBe(true);
  });

  it("opens a new slot after the window elapses", () => {
    for (let i = 0; i < SEARCH_START_LIMIT; i++) {
      searchStartRateLimit.noteSearchStarted(ip, t0);
    }
    expect(searchStartRateLimit.canStartSearch(ip, t0)).toBe(false);
    const afterWindow = t0 + SEARCH_START_WINDOW_MS + 1;
    expect(searchStartRateLimit.canStartSearch(ip, afterWindow)).toBe(true);
  });
});
