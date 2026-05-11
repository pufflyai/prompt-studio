import { describe, expect, it } from "bun:test";
import { getDiffLineCount, isGeneratedDiffPath, isLargeDiffContent, LARGE_DIFF_LINE_THRESHOLD } from "./diff-size";

describe("isLargeDiffContent", () => {
  it("classifies diffs over 1000 changed lines as large", () => {
    expect(isLargeDiffContent({ additions: LARGE_DIFF_LINE_THRESHOLD + 1 })).toBe(true);
  });

  it("keeps diffs at 1000 changed lines eligible for eager loading", () => {
    expect(isLargeDiffContent({ additions: LARGE_DIFF_LINE_THRESHOLD })).toBe(false);
  });

  it("counts changed lines only", () => {
    expect(getDiffLineCount({ additions: 19, deletions: 19, newContent: "one\ntwo\n" })).toBe(38);
  });

  it("keeps a small edit in a huge file eligible for eager loading", () => {
    const content = Array.from({ length: LARGE_DIFF_LINE_THRESHOLD + 1 }, (_, index) => `line ${index}`).join("\n");

    expect(isLargeDiffContent({ additions: 19, deletions: 19, oldContent: content, newContent: content })).toBe(false);
  });
});

describe("isGeneratedDiffPath", () => {
  it("detects common lockfiles and generated bundles", () => {
    expect(isGeneratedDiffPath("package-lock.json")).toBe(true);
    expect(isGeneratedDiffPath("apps/web/pnpm-lock.yaml")).toBe(true);
    expect(isGeneratedDiffPath("dist/app.min.js")).toBe(true);
  });

  it("keeps normal source files eligible for automatic loading", () => {
    expect(isGeneratedDiffPath("src/app.ts")).toBe(false);
  });
});
