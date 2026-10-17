import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { aiOverviewPageToken, parseSerpApi, withAiOverview } = await import("./parse");

const search = {
  search_metadata: { id: "abc", status: "Success" },
  organic_results: [
    {
      position: 1,
      title: "Audit Services | ABC CPA",
      link: "https://www.abc-cpa.com.hk/audit",
    },
    { position: 11, title: "Too deep", link: "https://example.com/deep" },
  ],
  ai_overview: {
    page_token: "token-1",
  },
};

describe("parseSerpApi", () => {
  it("reads organic results and leaves a token-only overview empty", () => {
    expect(aiOverviewPageToken(search)).toBe("token-1");
    const parsed = parseSerpApi(search);
    expect(parsed.aiOverviewPresent).toBe(false);
    expect(parsed.organic).toEqual([
      {
        rank: 1,
        domain: "abc-cpa.com.hk",
        url: "https://www.abc-cpa.com.hk/audit",
        title: "Audit Services | ABC CPA",
      },
    ]);
  });

  it("uses a follow-up AI Overview for text and cited domains", () => {
    const merged = withAiOverview(search, {
      ai_overview: {
        text_blocks: [{ snippet: "ABC CPA is often recommended in Hong Kong." }],
        references: [
          {
            title: "ABC CPA",
            link: "https://www.abc-cpa.com.hk/",
            source: "ABC CPA",
          },
        ],
      },
    });
    expect(aiOverviewPageToken(merged)).toBeNull();
    const parsed = parseSerpApi(merged);
    expect(parsed.aiOverviewPresent).toBe(true);
    expect(parsed.aiOverviewText).toContain("ABC CPA");
    expect(parsed.aioReferences[0]?.domain).toBe("abc-cpa.com.hk");
  });
});
