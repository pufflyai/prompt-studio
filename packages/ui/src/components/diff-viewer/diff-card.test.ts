import { describe, expect, it } from "bun:test";
import {
  resolveDiffFilePath,
  resolveRequestedDiffPath,
  shouldAutoLoadDiffContent,
  shouldShowDiffStats,
} from "./diff-card";

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

  it("does not auto-load an expanded summary until it is selected", () => {
    expect(
      shouldAutoLoadDiffContent({
        isExpanded: true,
        isSelected: false,
        hasDiffContent: false,
        isLargeDiff: false,
        isGeneratedDiff: false,
        isBinaryDiff: false,
        requestedPath: null,
        filePath: "src/other.ts",
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

  it("does not auto-load non-image binary summary diffs", () => {
    expect(
      shouldAutoLoadDiffContent({
        isExpanded: true,
        isSelected: true,
        hasDiffContent: false,
        isLargeDiff: false,
        isGeneratedDiff: false,
        isBinaryDiff: true,
        requestedPath: null,
        filePath: "docs/spec.pdf",
      }),
    ).toBe(false);
  });

  it("auto-loads image summary diffs when image content can be fetched", () => {
    expect(
      shouldAutoLoadDiffContent({
        isExpanded: true,
        isSelected: true,
        hasDiffContent: false,
        isLargeDiff: false,
        isGeneratedDiff: false,
        isBinaryDiff: false,
        requestedPath: null,
        filePath: "assets/logo.png",
      }),
    ).toBe(true);
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

describe("shouldShowDiffStats", () => {
  it("hides line stats for image preview diffs", () => {
    expect(shouldShowDiffStats("assets/logo.png")).toBe(false);
    expect(shouldShowDiffStats("photo.JPG")).toBe(false);
  });

  it("keeps line stats for text diffs", () => {
    expect(shouldShowDiffStats("icons/logo.svg")).toBe(true);
    expect(shouldShowDiffStats("README.md")).toBe(true);
  });
});

describe("resolveDiffFilePath", () => {
  it("uses the visible new path before old path", () => {
    expect(
      resolveDiffFilePath({
        change: "renamed",
        oldPath: "src/old.ts",
        newPath: "src/new.ts",
      }),
    ).toBe("src/new.ts");
  });

  it("falls back to the old path", () => {
    expect(
      resolveDiffFilePath({
        change: "deleted",
        oldPath: "src/removed.ts",
      }),
    ).toBe("src/removed.ts");
  });
});
