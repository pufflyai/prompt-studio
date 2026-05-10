import { describe, expect, it } from "bun:test";
import { buildInitialExpandedPaths, type Diff } from "./diff-drawer";

const diffs: Diff[] = [
  { change: "modified", newPath: "src/a.ts" },
  { change: "modified", newPath: "src/b.ts" },
];

describe("buildInitialExpandedPaths", () => {
  it("expands only the selected diff by default", () => {
    expect([...buildInitialExpandedPaths(diffs, "src/b.ts")]).toEqual(["src/b.ts"]);
  });

  it("collapses all diffs when there is no selected diff", () => {
    expect([...buildInitialExpandedPaths(diffs, null)]).toEqual([]);
  });
});
