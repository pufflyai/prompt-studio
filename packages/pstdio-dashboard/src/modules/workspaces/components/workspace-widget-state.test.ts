import { describe, expect, test } from "bun:test";
import { resolveWorkspaceForkPointDiffWorkspaceId } from "./workspace-widget-state";

describe("resolveWorkspaceForkPointDiffWorkspaceId", () => {
  test("skips current-branch workspaces because they have no fork point", () => {
    expect(
      resolveWorkspaceForkPointDiffWorkspaceId({
        resourceId: "workspace-current",
        metadata: { workspaceType: "current_branch" },
      }),
    ).toBeUndefined();
  });

  test("loads fork-point diffs for worktree workspaces", () => {
    expect(
      resolveWorkspaceForkPointDiffWorkspaceId({
        resourceId: "workspace-worktree",
        metadata: { workspaceType: "worktree" },
      }),
    ).toBe("workspace-worktree");
  });

  test("uses workspace metadata id when the resource id is not the workspace id", () => {
    expect(
      resolveWorkspaceForkPointDiffWorkspaceId({
        resourceId: "workspace-resource",
        metadata: { workspaceId: "workspace-metadata", workspaceType: "worktree" },
      }),
    ).toBe("workspace-metadata");
  });
});
