import { describe, expect, it } from "bun:test";
import {
  buildInitialCollapsedPaths,
  type Diff,
  estimateDiffCardHeight,
  resolveCollapsedPathsForSelectedDiff,
  toggleCollapsedPath,
} from "./diff-drawer";
import { LARGE_DIFF_LINE_THRESHOLD } from "./diff-size";

const diffs: Diff[] = [
  { change: "modified", newPath: "src/a.ts" },
  { change: "modified", newPath: "src/b.ts" },
];

describe("buildInitialCollapsedPaths", () => {
  it("opens the first 20 diffs by default", () => {
    const manyDiffs: Diff[] = Array.from({ length: 22 }, (_, index) => ({
      change: "modified",
      newPath: `src/file-${index + 1}.ts`,
    }));

    expect([...buildInitialCollapsedPaths(manyDiffs)]).toEqual(["src/file-21.ts", "src/file-22.ts"]);
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

  it("uses rendered hunk rows when loaded content has sparse changes", () => {
    const lines = Array.from({ length: 30 }, (_, i) => `line ${i + 1}`);
    const modified = [...lines];
    modified[15] = "changed line 16";
    const summaryOnly: Diff = { change: "modified", newPath: "src/a.ts", additions: 1, deletions: 1 };
    const loaded: Diff = {
      ...summaryOnly,
      oldContent: lines.join("\n"),
      newContent: modified.join("\n"),
    };

    expect(estimateDiffCardHeight(loaded, false)).toBeGreaterThan(estimateDiffCardHeight(summaryOnly, false) * 2);
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
