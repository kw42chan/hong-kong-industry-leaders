import { describe, expect, it } from "vitest";
import {
  classifyReferrerHeuristic,
  isReferrerByHeuristics,
} from "./referrer-heuristics";

describe("referrer heuristics", () => {
  it("flags aggregator blocklist without LLM eligibility", () => {
    const r = classifyReferrerHeuristic({ domain: "www.openrice.com" });
    expect(r.isReferrer).toBe(true);
    expect(r.reason).toBe("aggregator_blocklist");
  });

  it("flags listicle titles", () => {
    expect(
      isReferrerByHeuristics({
        domain: "example.com.hk",
        title: "2025 十大香港會計師事務所推薦清單",
      }),
    ).toBe(true);
    expect(
      isReferrerByHeuristics({
        domain: "example.com",
        title: "Best Accounting Firms in Hong Kong",
      }),
    ).toBe(true);
  });

  it("flags editorial URL paths", () => {
    expect(
      isReferrerByHeuristics({
        domain: "firm.com.hk",
        url: "https://firm.com.hk/blog/best-accountants",
      }),
    ).toBe(true);
  });

  it("allows operator-like domains without listicle cues", () => {
    expect(
      isReferrerByHeuristics({
        domain: "abc-cpa.com.hk",
        title: "會計及核數服務 | ABC CPA",
        url: "https://abc-cpa.com.hk/services",
      }),
    ).toBe(false);
  });
});
