import { describe, expect, it } from "bun:test";
import { resolveRequestedDiffPath, shouldAutoLoadDiffContent } from "./diff-card";

describe("shouldAutoLoadDiffContent", () => {
  it("auto-loads expanded normal summary diffs", () => {
    expect(
      shouldAutoLoadDiffContent({
        isExpanded: true,
        isSelected: true,
        hasDiffContent: false,
        isLargeDiff: false,
        isGeneratedDiff: false,
        isBinaryDiff: false,
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
        isBinaryDiff: false,
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
        isBinaryDiff: false,
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
        isBinaryDiff: false,
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
        isBinaryDiff: false,
        requestedPath: null,
        filePath: "package-lock.json",
      }),
    ).toBe(false);
  });

  it("does not auto-load binary summary diffs", () => {
    expect(
      shouldAutoLoadDiffContent({
        isExpanded: true,
        isSelected: true,
        hasDiffContent: false,
        isLargeDiff: false,
        isGeneratedDiff: false,
        isBinaryDiff: true,
        requestedPath: null,
        filePath: "assets/logo.png",
      }),
    ).toBe(false);
  });
});

describe("resolveRequestedDiffPath", () => {
  it("clears requested path once content arrives", () => {
    expect(
      resolveRequestedDiffPath({
        requestedPath: "src/app.ts",
        filePath: "src/app.ts",
        hasDiffContent: true,
      }),
    ).toBeNull();
  });

  it("keeps requested path while content is still missing", () => {
    expect(
      resolveRequestedDiffPath({
        requestedPath: "src/app.ts",
        filePath: "src/app.ts",
        hasDiffContent: false,
      }),
    ).toBe("src/app.ts");
  });
});
