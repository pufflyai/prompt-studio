import { describe, expect, mock, test } from "bun:test";
import { createSessionsApi } from "./sessions";
import { createWorkspacesApi } from "./workspaces";

const otherWorkspace = {
  id: "workspace-other",
  project_id: "project-other",
  provider_capabilities_json: { delete: true },
};
const otherSession = {
  id: "session-other",
  project_id: "project-other",
  anchors_json: [],
};

describe("command environment project scope", () => {
  test("does not expose workspace or session ids owned by another project", async () => {
    const deleteProviderBackedWorkspace = mock(async () => false);
    const deps = {
      workspaceService: {
        get: async () => otherWorkspace,
        getByShorthand: async () => null,
      },
      sessionService: { get: async () => otherSession, update: mock(async () => null) },
      workspaceSessionService: { listByWorkspace: async () => [otherSession] },
    } as never;
    const workspaces = createWorkspacesApi(deps, { projectId: "project-allowed" }, {
      deleteProviderBackedWorkspace,
    } as never);
    const sessions = createSessionsApi(deps, {
      projectId: "project-allowed",
      project: { id: "project-allowed", name: "Allowed", shorthand: "PA" },
    });

    expect(await workspaces.get("workspace-other")).toBeNull();
    await expect(workspaces.cancel("workspace-other")).rejects.toThrow("Workspace not found");
    await expect(
      workspaces.create({
        project_id: "project-other",
        shorthand_base: "remote",
        provider_id: "example.remote",
      }),
    ).rejects.toThrow("project");
    expect(deleteProviderBackedWorkspace).not.toHaveBeenCalled();

    expect(await sessions.get("session-other")).toBeNull();
    await expect(sessions.listByWorkspace("workspace-other")).rejects.toThrow("Workspace not found");
    await expect(sessions.followup({ sessionId: "session-other", prompt: "cross project" })).rejects.toThrow(
      "Session not found",
    );
    await expect(sessions.addAnchors("session-other", [])).rejects.toThrow("Session not found");
  });

  test("enforces provider actions and never fabricates a remote target for an unready local workspace", async () => {
    let workspace = {
      id: "workspace-local",
      project_id: "project-allowed",
      provider_id: "pstdio.worktree",
      provider_state: "ready",
      provider_ref_json: null,
      provider_error_json: null,
      provider_capabilities_json: {
        files: "write",
        diff: true,
        merge: true,
        rebase: true,
        archive: false,
        delete: false,
      },
      execution_kind: "local",
      worktree_path: null,
      display_path: null,
      is_default: false,
      archived: false,
    };
    const deleteProviderBackedWorkspace = mock(async () => false);
    const deps = {
      workspaceService: {
        get: async () => workspace,
        getByShorthand: async () => null,
      },
    } as never;
    const workspaces = createWorkspacesApi(deps, { projectId: "project-allowed" }, {
      deleteProviderBackedWorkspace,
    } as never);

    await expect(workspaces.resolve(workspace.id)).rejects.toThrow("Local workspace execution target");
    await expect(workspaces.archive(workspace.id)).rejects.toThrow("does not allow archiving");
    await expect(workspaces.delete(workspace.id)).rejects.toThrow("does not allow deletion");
    expect(deleteProviderBackedWorkspace).not.toHaveBeenCalled();

    workspace = {
      ...workspace,
      is_default: true,
      provider_capabilities_json: { ...workspace.provider_capabilities_json, archive: true, delete: true },
    };
    await expect(workspaces.archive(workspace.id)).rejects.toThrow("Default workspace");
    await expect(workspaces.delete(workspace.id)).rejects.toThrow("Default workspace");
  });
});
