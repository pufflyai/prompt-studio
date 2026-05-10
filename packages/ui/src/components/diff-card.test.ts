import { describe, expect, it } from "bun:test";
import { shouldAutoLoadDiffContent } from "./diff-card";

describe("shouldAutoLoadDiffContent", () => {
  it("does not auto-load selected summary diffs when file size is unknown", () => {
    expect(
      shouldAutoLoadDiffContent({
        isExpanded: true,
        isSelected: true,
        hasDiffContent: false,
        isLargeDiff: false,
        requestedPath: null,
        filePath: "src/app.ts",
      }),
    ).toBe(false);
  });

  it("does not auto-load when content is already available", () => {
    expect(
      shouldAutoLoadDiffContent({
        isExpanded: true,
        isSelected: true,
        hasDiffContent: true,
        isLargeDiff: false,
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
        requestedPath: "src/app.ts",
        filePath: "src/app.ts",
      }),
    ).toBe(false);
  });
});
