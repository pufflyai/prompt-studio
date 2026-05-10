import { describe, expect, it } from "bun:test";
import { isLargeDiffContent, LARGE_DIFF_CONTENT_LENGTH } from "./diff-size";

describe("isLargeDiffContent", () => {
  it("classifies very large diff bodies as large", () => {
    expect(isLargeDiffContent({ newContent: "x".repeat(LARGE_DIFF_CONTENT_LENGTH + 1) })).toBe(true);
  });

  it("keeps small diff bodies eligible for eager rendering", () => {
    expect(isLargeDiffContent({ oldContent: "before", newContent: "after" })).toBe(false);
  });
});
