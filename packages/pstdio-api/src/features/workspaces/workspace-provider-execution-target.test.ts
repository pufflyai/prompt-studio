import { describe, expect, test } from "bun:test";
import { makeWorkspace } from "./workspace-provider.test-fixture";
import { resolveWorkspaceLocation } from "./workspace-provider-execution-target";
import { resolveWorkspaceExecutionTarget } from "./workspace-provider-service";

describe("resolveWorkspaceExecutionTarget", () => {
  test("keeps a failed workspace location available to repair while denying execution", async () => {
    const workspace = makeWorkspace({
      provider_id: "pstdio.worktree",
      execution_kind: "local",
      worktree_path: "/worktree",
      setup_error: "Provisioning failed",
    });
    const deps = {
      workspaceService: { get: async () => workspace },
      repoService: { listByProject: async () => [{ id: "repo-1", path: "/repo" }] },
    } as never;

    expect((await resolveWorkspaceLocation(deps, workspace))?.root).toBe("/worktree");
    expect(await resolveWorkspaceExecutionTarget(deps, workspace.id)).toBeUndefined();
  });

  test("location projection does not grant file access", async () => {
    const workspace = makeWorkspace({
      execution_kind: "local",
      worktree_path: "/provider-files",
      provider_capabilities_json: {
        files: "none",
        diff: false,
        merge: false,
        rebase: false,
        archive: true,
        delete: true,
      },
    });
    const deps = {
      workspaceService: { get: async () => workspace },
      repoService: { listByProject: async () => [] },
    } as never;

    expect((await resolveWorkspaceLocation(deps, workspace))?.root).toBe("/provider-files");
    expect(await resolveWorkspaceExecutionTarget(deps, workspace.id, "files:read")).toBeUndefined();
  });

  test("does not project a stale local path for a remote workspace", async () => {
    const workspace = makeWorkspace({ execution_kind: "remote", worktree_path: "/stale-local-path" });
    const deps = { repoService: { listByProject: async () => [{ id: "repo-1", path: "/repo" }] } } as never;

    expect(await resolveWorkspaceLocation(deps, workspace)).toBeUndefined();
  });

  test("does not give a custom local provider the project folder when its target is missing", async () => {
    const workspace = makeWorkspace({ execution_kind: "local", worktree_path: null, is_default: false });
    const deps = { repoService: { listByProject: async () => [{ id: "repo-1", path: "/repo" }] } } as never;

    expect(await resolveWorkspaceLocation(deps, workspace)).toBeUndefined();
  });

  test("does not fall back to a project repository for remote workspaces", async () => {
    const result = await resolveWorkspaceExecutionTarget(
      {
        workspaceService: {
          get: async () =>
            makeWorkspace({
              id: "ws-remote",
              provider_state: "ready",
              execution_kind: "remote",
              worktree_path: null,
            }),
        },
        repoService: { listByProject: async () => [{ id: "repo-1", path: "/repo" }] },
      } as never,
      "ws-remote",
    );

    expect(result).toBeUndefined();
  });
});
