import { describe, expect, test } from "bun:test";
import { reviewLinkLabel, reviewLinkTooltip } from "./review-link-values";

describe("review link values", () => {
  test("labels prefer the external id, then title, then fallback text", () => {
    expect(reviewLinkLabel({ url: "https://example.com/review", externalId: "456", title: "Review changes" })).toBe(
      "456",
    );
    expect(reviewLinkLabel({ url: "https://example.com/review", externalId: null, title: "Review changes" })).toBe(
      "Review changes",
    );
    expect(reviewLinkLabel({ url: "https://example.com/review", externalId: null, title: null })).toBe("Review link");
  });

  test("does not expose the raw URL as display text", () => {
    const url = "https://github.com/org/repo/pull/456";
    const link = { url, externalId: null, title: null, provider: "github", kind: "pull_request" };

    expect(reviewLinkLabel(link)).not.toBe(url);
    expect(reviewLinkTooltip(link)).not.toContain(url);
    expect(reviewLinkLabel({ ...link, title: url })).not.toBe(url);
  });
});
