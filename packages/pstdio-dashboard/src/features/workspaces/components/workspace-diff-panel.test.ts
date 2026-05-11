import { describe, expect, it } from "bun:test";
import type { Diff } from "@pstdio/ui";
import {
  buildFilteredDiffs,
  buildLoadedDiffKey,
  resolveDisplayDiffs,
  retainLoadedDiffsForSummaries,
} from "./workspace-diff-panel";

const createDiff = (input: { newPath?: string; oldPath?: string }): Diff => ({
  change: "modified",
  newPath: input.newPath,
  oldPath: input.oldPath,
});

describe("resolveDisplayDiffs", () => {
  it("scopes loaded diff bodies by workspace", () => {
    const loadedDiffs = new Map<string, Diff>([
      [
        buildLoadedDiffKey("workspace-1", "src/app.ts"),
        { change: "modified", newPath: "src/app.ts", oldContent: "old workspace", newContent: "new workspace" },
      ],
    ]);

    const displayDiffs = resolveDisplayDiffs({
      workspaceId: "workspace-2",
      loadedDiffs,
      diffs: [{ change: "modified", newPath: "src/app.ts" }],
    });

    expect(displayDiffs[0].oldContent).toBeUndefined();
    expect(displayDiffs[0].newContent).toBeUndefined();
  });

  it("keeps loaded diff paths stable for drawer collapse keys", () => {
    const loadedDiffs = new Map<string, Diff>([
      [
        buildLoadedDiffKey("workspace-1", "src/app.ts"),
        { change: "modified", oldPath: "src/app.ts", newPath: "src/app.ts", oldContent: "old", newContent: "new" },
      ],
    ]);

    const displayDiffs = resolveDisplayDiffs({
      workspaceId: "workspace-1",
      loadedDiffs,
      diffs: [{ change: "modified", oldPath: "src/app.ts", newPath: "src/app.ts" }],
    });

    expect(displayDiffs[0].newPath ?? displayDiffs[0].oldPath).toBe("src/app.ts");
  });

  it("preserves loaded bodies when refreshed summary metadata is unchanged", () => {
    const loadedDiffs = new Map<string, Diff>([
      [
        buildLoadedDiffKey("workspace-1", "src/app.ts"),
        {
          change: "modified",
          oldPath: "src/app.ts",
          newPath: "src/app.ts",
          oldContent: "old",
          newContent: "new",
          additions: 1,
          deletions: 1,
        },
      ],
    ]);

    const displayDiffs = resolveDisplayDiffs({
      workspaceId: "workspace-1",
      loadedDiffs,
      diffs: [{ change: "modified", oldPath: "src/app.ts", newPath: "src/app.ts", additions: 1, deletions: 1 }],
    });

    expect(displayDiffs[0].oldContent).toBe("old");
    expect(displayDiffs[0].newContent).toBe("new");
  });

  it("discards loaded bodies when refreshed summary metadata changed", () => {
    const loadedDiffs = new Map<string, Diff>([
      [
        buildLoadedDiffKey("workspace-1", "src/app.ts"),
        {
          change: "modified",
          oldPath: "src/app.ts",
          newPath: "src/app.ts",
          oldContent: "old",
          newContent: "new",
          additions: 1,
          deletions: 1,
        },
      ],
    ]);

    const displayDiffs = resolveDisplayDiffs({
      workspaceId: "workspace-1",
      loadedDiffs,
      diffs: [{ change: "modified", oldPath: "src/app.ts", newPath: "src/app.ts", additions: 2, deletions: 1 }],
    });

    expect(displayDiffs[0].oldContent).toBeUndefined();
    expect(displayDiffs[0].newContent).toBeUndefined();
  });
});

describe("retainLoadedDiffsForSummaries", () => {
  it("drops loaded bodies for removed files", () => {
    const retained = retainLoadedDiffsForSummaries({
      workspaceId: "workspace-1",
      diffs: [],
      loadedDiffs: new Map([
        [
          buildLoadedDiffKey("workspace-1", "removed.ts"),
          { change: "deleted", oldPath: "removed.ts", oldContent: "old", newContent: "", additions: 0, deletions: 1 },
        ],
      ]),
    });

    expect(retained.size).toBe(0);
  });
});

describe("buildFilteredDiffs", () => {
  it("keeps filtered diffs sorted when search is active", () => {
    const filtered = buildFilteredDiffs({
      diffs: [
        createDiff({ newPath: "src/z.ts" }),
        createDiff({ newPath: "src/a.ts" }),
        createDiff({ newPath: "README.md" }),
      ],
      normalizedSearchQuery: "src/",
      viewMode: "flat",
    });

    expect(filtered.map((diff) => diff.newPath ?? diff.oldPath)).toEqual(["src/a.ts", "src/z.ts"]);
  });

  it("changes ordering when switching between nested and flat mode", () => {
    const diffs = [
      createDiff({ newPath: "src" }),
      createDiff({ newPath: "src/a.ts" }),
      createDiff({ newPath: "README.md" }),
    ];

    const nested = buildFilteredDiffs({ diffs, normalizedSearchQuery: "", viewMode: "nested" });
    const flat = buildFilteredDiffs({ diffs, normalizedSearchQuery: "", viewMode: "flat" });

    expect(nested.map((diff) => diff.newPath ?? diff.oldPath)).toEqual(["src/a.ts", "README.md", "src"]);
    expect(flat.map((diff) => diff.newPath ?? diff.oldPath)).toEqual(["README.md", "src", "src/a.ts"]);
  });
});
