import { describe, expect, it } from "bun:test";
import type { Diff } from "@pstdio/ui";
import { sortDiffs } from "./sort-diffs";

const createDiff = (path: string): Diff => ({
  change: "modified",
  newPath: path,
});

const createOldPathDiff = (path: string): Diff => ({
  change: "deleted",
  oldPath: path,
});

const createUnknownPathDiff = (): Diff => ({
  change: "modified",
});

describe("sortDiffs", () => {
  it("sorts diffs by file-tree order in nested mode", () => {
    const sorted = sortDiffs(
      [
        createDiff("src"),
        createDiff("README.md"),
        createDiff("src/z.ts"),
        createDiff("src/app/b.ts"),
        createDiff("src/app/a.ts"),
      ],
      "nested",
    );

    expect(sorted.map((diff) => diff.newPath)).toEqual([
      "src/app/a.ts",
      "src/app/b.ts",
      "src/z.ts",
      "README.md",
      "src",
    ]);
  });

  it("sorts diffs alphabetically by full path in flat mode", () => {
    const sorted = sortDiffs(
      [
        createDiff("src"),
        createDiff("README.md"),
        createDiff("src/z.ts"),
        createDiff("src/app/b.ts"),
        createDiff("src/app/a.ts"),
      ],
      "flat",
    );

    expect(sorted.map((diff) => diff.newPath)).toEqual([
      "README.md",
      "src",
      "src/app/a.ts",
      "src/app/b.ts",
      "src/z.ts",
    ]);
  });

  it("uses oldPath as fallback when newPath is missing", () => {
    const sorted = sortDiffs(
      [createOldPathDiff("src/z.ts"), createOldPathDiff("src/a.ts"), createDiff("README.md")],
      "flat",
    );

    expect(sorted.map((diff) => diff.newPath ?? diff.oldPath)).toEqual(["README.md", "src/a.ts", "src/z.ts"]);
  });

  it("sorts unknown fallback paths consistently in nested and flat modes", () => {
    const nested = sortDiffs([createUnknownPathDiff(), createDiff("src/a.ts")], "nested");
    const flat = sortDiffs([createUnknownPathDiff(), createDiff("src/a.ts")], "flat");

    expect(nested.map((diff) => diff.newPath ?? diff.oldPath ?? "unknown")).toEqual(["src/a.ts", "unknown"]);
    expect(flat.map((diff) => diff.newPath ?? diff.oldPath ?? "unknown")).toEqual(["src/a.ts", "unknown"]);
  });
});
