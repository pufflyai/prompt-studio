import { describe, expect, it } from "bun:test";
import { LARGE_DIFF_LINE_THRESHOLD } from "../diff-size";
import {
  buildAllCollapsedPaths,
  buildInitialCollapsedPaths,
  type Diff,
  estimateDiffCardHeight,
  resolveCollapsedPathsForSelectedDiff,
  toggleCollapsedPath,
} from "./diff-drawer";

const diffs: Diff[] = [
  { change: "modified", newPath: "src/a.ts" },
  { change: "modified", newPath: "src/b.ts" },
];

describe("buildInitialCollapsedPaths", () => {
  it("opens every diff when there are 10 or fewer", () => {
    const fewDiffs: Diff[] = Array.from({ length: 10 }, (_, index) => ({
      change: "modified",
      newPath: `src/file-${index + 1}.ts`,
      additions: 90,
      deletions: 20,
    }));

    expect([...buildInitialCollapsedPaths(fewDiffs)]).toEqual([]);
  });

  it("opens only the first 10 diffs when there are more than 10", () => {
    const manyDiffs: Diff[] = Array.from({ length: 22 }, (_, index) => ({
      change: "modified",
      newPath: `src/file-${index + 1}.ts`,
    }));

    expect([...buildInitialCollapsedPaths(manyDiffs)]).toEqual([
      "src/file-11.ts",
      "src/file-12.ts",
      "src/file-13.ts",
      "src/file-14.ts",
      "src/file-15.ts",
      "src/file-16.ts",
      "src/file-17.ts",
      "src/file-18.ts",
      "src/file-19.ts",
      "src/file-20.ts",
      "src/file-21.ts",
      "src/file-22.ts",
    ]);
  });

  it("collapses diffs over 100 changed lines when there are more than 10", () => {
    const manyDiffs: Diff[] = Array.from({ length: 12 }, (_, index) => ({
      change: "modified",
      newPath: `src/file-${index + 1}.ts`,
      additions: index === 1 ? 80 : 1,
      deletions: index === 1 ? 21 : 1,
    }));

    expect([...buildInitialCollapsedPaths(manyDiffs)]).toEqual(["src/file-2.ts", "src/file-11.ts", "src/file-12.ts"]);
  });
});

describe("buildAllCollapsedPaths", () => {
  it("collapses every diff path", () => {
    expect([...buildAllCollapsedPaths(diffs)]).toEqual(["src/a.ts", "src/b.ts"]);
  });
});

describe("toggleCollapsedPath", () => {
  it("tracks manually collapsed paths", () => {
    expect([...toggleCollapsedPath(new Set(), "src/a.ts")]).toEqual(["src/a.ts"]);
    expect([...toggleCollapsedPath(new Set(["src/a.ts"]), "src/a.ts")]).toEqual([]);
  });
});

describe("resolveCollapsedPathsForSelectedDiff", () => {
  it("reopens the selected diff when it exists", () => {
    const collapsedPaths = new Set(["src/a.ts", "src/b.ts"]);

    expect([...resolveCollapsedPathsForSelectedDiff(diffs, collapsedPaths, "src/b.ts")]).toEqual(["src/a.ts"]);
  });

  it("keeps collapsed paths when selected diff is missing", () => {
    const collapsedPaths = new Set(["src/a.ts"]);

    expect([...resolveCollapsedPathsForSelectedDiff(diffs, collapsedPaths, "src/missing.ts")]).toEqual(["src/a.ts"]);
  });
});

describe("estimateDiffCardHeight", () => {
  it("scales with the diff's line count so navigation offsets stay accurate", () => {
    const small: Diff = { change: "modified", newPath: "src/a.ts", additions: 2, deletions: 0 };
    const large: Diff = { change: "modified", newPath: "src/b.ts", additions: 80, deletions: 60 };

    expect(estimateDiffCardHeight(large, false)).toBeGreaterThan(estimateDiffCardHeight(small, false) * 5);
  });

  it("uses cheap summary counts instead of parsing loaded content", () => {
    const lines = Array.from({ length: 30 }, (_, i) => `line ${i + 1}`);
    const modified = [...lines];
    modified[15] = "changed line 16";
    const summaryOnly: Diff = { change: "modified", newPath: "src/a.ts", additions: 1, deletions: 1 };
    const loaded: Diff = {
      ...summaryOnly,
      oldContent: lines.join("\n"),
      newContent: modified.join("\n"),
    };

    expect(estimateDiffCardHeight(loaded, false)).toBe(estimateDiffCardHeight(summaryOnly, false));
  });

  it("estimates hidden large diffs by placeholder height until opted in", () => {
    const lineCount = LARGE_DIFF_LINE_THRESHOLD + 1;
    const large: Diff = {
      change: "modified",
      newPath: "src/large.ts",
      oldContent: "",
      newContent: Array.from({ length: lineCount }, (_, i) => `line ${i + 1}`).join("\n"),
      additions: lineCount,
      deletions: 0,
    };

    expect(estimateDiffCardHeight(large, false)).toBeLessThan(estimateDiffCardHeight(large, false, true));
  });

  it("returns a compact height when collapsed regardless of size", () => {
    const big: Diff = { change: "modified", newPath: "src/a.ts", additions: 500, deletions: 500 };

    expect(estimateDiffCardHeight(big, true)).toBeLessThan(estimateDiffCardHeight(big, false));
  });

  it("falls back to a deferred body height when the summary has no line counts", () => {
    const unloaded: Diff = { change: "modified", newPath: "src/a.ts" };
    const tinyLoaded: Diff = { change: "modified", newPath: "src/a.ts", additions: 1, deletions: 0 };

    expect(estimateDiffCardHeight(unloaded, false)).toBeGreaterThan(estimateDiffCardHeight(tinyLoaded, false));
  });
});
