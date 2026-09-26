import { describe, expect, test } from "bun:test";
import { resolveDefaultWorkspaceDiffPath, resolveWorkspaceDiffRequest } from "./workspace-widget-state";

describe("resolveWorkspaceDiffRequest", () => {
  test("loads current changes for current-branch workspaces", () => {
    expect(
      resolveWorkspaceDiffRequest({
        resourceId: "workspace-current",
        metadata: { workspaceProviderState: "ready", workspaceType: "current_branch" },
      }),
    ).toEqual({ workspaceId: "workspace-current", mode: "current" });
  });

  test("loads fork-point diffs for worktree workspaces", () => {
    expect(
      resolveWorkspaceDiffRequest({
        resourceId: "workspace-worktree",
        metadata: { workspaceProviderState: "ready", workspaceType: "worktree" },
      }),
    ).toEqual({ workspaceId: "workspace-worktree", mode: "fork_point" });
  });

  test("uses workspace metadata id when the resource id is not the workspace id", () => {
    expect(
      resolveWorkspaceDiffRequest({
        resourceId: "workspace-resource",
        metadata: { workspaceProviderState: "ready", workspaceId: "workspace-metadata", workspaceType: "worktree" },
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

test.each([
  undefined,
  "provisioning",
  "failed",
])("does not request diffs before workspace readiness: %s", (workspaceProviderState) => {
  expect(
    resolveWorkspaceDiffRequest({
      resourceId: "preparing-workspace",
      metadata: { workspaceSupportsDiff: true, workspaceProviderState },
    }),
  ).toBeUndefined();
});
test("does not request diffs when workspace setup has failed", () => {
  expect(
    resolveWorkspaceDiffRequest({
      resourceId: "failed-workspace",
      metadata: { workspaceSupportsDiff: true, workspaceProviderState: "ready", workspaceError: "Setup failed" },
    }),
  ).toBeUndefined();
});

test("does not request diffs when workspace support is explicitly disabled", () => {
  expect(
    resolveWorkspaceDiffRequest({
      resourceId: "cloud-workspace",
      metadata: { workspaceProviderState: "ready", workspaceSupportsDiff: false },
    }),
  ).toBeUndefined();
});
