import { describe, expect, it } from "bun:test";
import {
  buildAllCollapsedPaths,
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
  it("scales with the rendered line count so navigation offsets stay accurate", () => {
    const small: Diff = {
      change: "added",
      newPath: "src/a.ts",
      oldContent: "",
      newContent: "one\ntwo\n",
    };
    const large: Diff = {
      change: "added",
      newPath: "src/b.ts",
      oldContent: "",
      newContent: Array.from({ length: 100 }, (_, i) => `line ${i + 1}`).join("\n"),
    };

    expect(estimateDiffCardHeight({ diff: large, isCollapsed: false })).toBeGreaterThan(
      estimateDiffCardHeight({ diff: small, isCollapsed: false }) * 5,
    );
  });

  it("derives the estimate from rendered diff content, not the summary counts", () => {
    const lines = Array.from({ length: 60 }, (_, i) => `line ${i + 1}`);
    const oneChange = [...lines];
    oneChange[30] = "changed line 31";
    const manyChanges = lines.map((line, i) => (i % 2 === 0 ? `changed ${line}` : line));

    // Identical summary counts, but the second diff renders far more rows.
    const fewRows: Diff = {
      change: "modified",
      newPath: "src/a.ts",
      oldContent: lines.join("\n"),
      newContent: oneChange.join("\n"),
      additions: 1,
      deletions: 1,
    };
    const manyRows: Diff = {
      change: "modified",
      newPath: "src/b.ts",
      oldContent: lines.join("\n"),
      newContent: manyChanges.join("\n"),
      additions: 1,
      deletions: 1,
    };

    expect(estimateDiffCardHeight({ diff: manyRows, isCollapsed: false })).toBeGreaterThan(
      estimateDiffCardHeight({ diff: fewRows, isCollapsed: false }),
    );
  });

  it("estimates unified taller than split for a modify-heavy diff", () => {
    const lines = Array.from({ length: 40 }, (_, i) => `line ${i + 1}`);
    const modified = [...lines];
    modified[10] = "changed line 11";
    modified[25] = "changed line 26";
    const diff: Diff = {
      change: "modified",
      newPath: "src/a.ts",
      oldContent: lines.join("\n"),
      newContent: modified.join("\n"),
      additions: 2,
      deletions: 2,
    };

    // Unified stacks each modified line as delete + add; split pairs them onto one row.
    expect(estimateDiffCardHeight({ diff, isCollapsed: false, diffViewMode: "unified" })).toBeGreaterThan(
      estimateDiffCardHeight({ diff, isCollapsed: false, diffViewMode: "split" }),
    );
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

    expect(estimateDiffCardHeight({ diff: large, isCollapsed: false })).toBeLessThan(
      estimateDiffCardHeight({ diff: large, isCollapsed: false, hasOptedIntoLargeDiff: true }),
    );
  });

  it("returns a compact height when collapsed regardless of size", () => {
    const big: Diff = {
      change: "modified",
      newPath: "src/a.ts",
      oldContent: "",
      newContent: Array.from({ length: 200 }, (_, i) => `line ${i + 1}`).join("\n"),
      additions: 200,
      deletions: 0,
    };

    expect(estimateDiffCardHeight({ diff: big, isCollapsed: true })).toBeLessThan(
      estimateDiffCardHeight({ diff: big, isCollapsed: false }),
    );
  });

  it("uses a fixed deferred height for diffs whose content is not loaded", () => {
    const unloaded: Diff = { change: "modified", newPath: "src/a.ts" };
    const unloadedWithSummary: Diff = { change: "modified", newPath: "src/a.ts", additions: 40, deletions: 10 };

    // No content means the card renders the deferred placeholder, not the editor — the
    // summary counts must not influence the estimate.
    expect(estimateDiffCardHeight({ diff: unloaded, isCollapsed: false })).toBe(
      estimateDiffCardHeight({ diff: unloadedWithSummary, isCollapsed: false }),
    );
  });
});
