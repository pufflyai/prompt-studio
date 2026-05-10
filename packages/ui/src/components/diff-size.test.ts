import { describe, expect, it } from "bun:test";
import { getDiffLineCount, isLargeDiffContent, LARGE_DIFF_LINE_THRESHOLD } from "./diff-size";

describe("isLargeDiffContent", () => {
  it("classifies diffs over 1000 changed lines as large", () => {
    expect(isLargeDiffContent({ additions: LARGE_DIFF_LINE_THRESHOLD + 1 })).toBe(true);
  });

  it("keeps diffs at 1000 changed lines eligible for eager loading", () => {
    expect(isLargeDiffContent({ additions: LARGE_DIFF_LINE_THRESHOLD })).toBe(false);
  });

  it("falls back to content lines when change counts are unavailable", () => {
    expect(getDiffLineCount({ newContent: "one\ntwo\n" })).toBe(2);
  });

  it("classifies a huge file with a small edit as large after content loads", () => {
    const content = Array.from({ length: LARGE_DIFF_LINE_THRESHOLD + 1 }, (_, index) => `line ${index}`).join("\n");

    expect(isLargeDiffContent({ additions: 1, deletions: 1, oldContent: content, newContent: content })).toBe(true);
  });
});
