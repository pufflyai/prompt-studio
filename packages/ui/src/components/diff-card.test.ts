import { describe, expect, it } from "bun:test";
import { shouldAutoLoadDiffContent } from "./diff-card";

describe("shouldAutoLoadDiffContent", () => {
  it("auto-loads expanded normal summary diffs", () => {
    expect(
      shouldAutoLoadDiffContent({
        isExpanded: true,
        isSelected: true,
        hasDiffContent: false,
        isLargeDiff: false,
        isGeneratedDiff: false,
        requestedPath: null,
        filePath: "src/app.ts",
      }),
    ).toBe(true);
  });

  it("does not auto-load when content is already available", () => {
    expect(
      shouldAutoLoadDiffContent({
        isExpanded: true,
        isSelected: true,
        hasDiffContent: true,
        isLargeDiff: false,
        isGeneratedDiff: false,
        requestedPath: null,
        filePath: "src/app.ts",
      }),
    ).toBe(false);
  });

  it("does not retry an already requested path automatically", () => {
    expect(
      shouldAutoLoadDiffContent({
        isExpanded: true,
        isSelected: true,
        hasDiffContent: true,
        isLargeDiff: false,
        isGeneratedDiff: false,
        requestedPath: "src/app.ts",
        filePath: "src/app.ts",
      }),
    ).toBe(false);
  });

  it("does not auto-load large or generated summary diffs", () => {
    expect(
      shouldAutoLoadDiffContent({
        isExpanded: true,
        isSelected: true,
        hasDiffContent: false,
        isLargeDiff: true,
        isGeneratedDiff: false,
        requestedPath: null,
        filePath: "src/app.ts",
      }),
    ).toBe(false);

    expect(
      shouldAutoLoadDiffContent({
        isExpanded: true,
        isSelected: true,
        hasDiffContent: false,
        isLargeDiff: false,
        isGeneratedDiff: true,
        requestedPath: null,
        filePath: "package-lock.json",
      }),
    ).toBe(false);
  });
});
