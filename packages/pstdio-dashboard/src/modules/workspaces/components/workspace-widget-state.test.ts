import { describe, expect, test } from "bun:test";
import { resolveWorkspaceDiffRequest } from "./workspace-widget-state";

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
