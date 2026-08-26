import { describe, expect, test } from "bun:test";
import { resolveDefaultWorkspaceDiffPath, resolveWorkspaceDiffRequest } from "./workspace-widget-state";

describe("resolveWorkspaceDiffRequest", () => {
  test("loads current changes for current-branch workspaces", () => {
    expect(
      resolveWorkspaceDiffRequest({
        resourceId: "workspace-current",
        metadata: { workspaceType: "current_branch" },
      }),
    ).toEqual({ workspaceId: "workspace-current", mode: "current" });
  });

  test("loads fork-point diffs for worktree workspaces", () => {
    expect(
      resolveWorkspaceDiffRequest({
        resourceId: "workspace-worktree",
        metadata: { workspaceType: "worktree" },
      }),
    ).toEqual({ workspaceId: "workspace-worktree", mode: "fork_point" });
  });

  test("uses workspace metadata id when the resource id is not the workspace id", () => {
    expect(
      resolveWorkspaceDiffRequest({
        resourceId: "workspace-resource",
        metadata: { workspaceId: "workspace-metadata", workspaceType: "worktree" },
      }),
    ).toEqual({ workspaceId: "workspace-metadata", mode: "fork_point" });
  });
});

describe("resolveDefaultWorkspaceDiffPath", () => {
  test("starts with the first diff whose content can load automatically", () => {
    expect(
      resolveDefaultWorkspaceDiffPath([
        { filePath: ".agents/skills/generated.ts", change: "added", additions: 1_200, deletions: 0 },
        { filePath: "assets/logo.png", change: "added", additions: 1, deletions: 0 },
        { filePath: "changed.ts", change: "modified", additions: 1, deletions: 1 },
      ]),
    ).toBe("changed.ts");
  });
});
