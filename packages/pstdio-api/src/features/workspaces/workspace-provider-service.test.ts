import { describe, expect, mock, test } from "bun:test";
import type { WorkspaceProviderResult } from "pstdio-api-contracts/extension-kernel";
import { createProviderBackedWorkspace } from "./workspace-provider-service";

const makeWorkspace = (id: string) => ({
  id,
  project_id: "project-1",
  name: "WS-1",
  branch: null,
  worktree_path: null,
  provider_id: "pocketcoder.remote",
  provider_params_json: {},
  provider_ref_json: null,
  provider_state: "provisioning" as const,
  execution_kind: "remote" as const,
  provider_operation_id: null,
  provider_operation_kind: null,
  provider_error_json: null,
  provider_capabilities_json: {
    files: "none" as const,
    diff: false,
    merge: false,
    rebase: false,
    archive: true,
    delete: true,
  },
  display_path: null,
  is_default: false,
  archived: false,
  workspace_shorthand: "WS-1",
  initializing: false,
  setup_error: null,
  startup_log_file_id: null,
  anchors_json: [],
  created_at: "2026-08-26T00:00:00.000Z",
  updated_at: "2026-08-26T00:00:00.000Z",
  deleted_at: null,
});

describe("createProviderBackedWorkspace", () => {
  test("stores a remote provider result without a worktree path", async () => {
    const providerResult: WorkspaceProviderResult = {
      providerRef: { version: 1, data: { remoteId: "remote-1" } },
      state: "ready",
      executionKind: "remote",
      executionTarget: {
        kind: "remote",
        providerId: "pocketcoder.remote",
        providerRef: { version: 1, data: { remoteId: "remote-1" } },
        displayPath: "Pocket Coder remote-1",
      },
      displayPath: "Pocket Coder remote-1",
      capabilities: {
        files: "none",
        diff: false,
        merge: false,
        rebase: false,
        archive: true,
        delete: true,
      },
    };
    const create = mock(async () => makeWorkspace("ws-1"));
    const updateProviderProjection = mock(async (_id: string, patch: Record<string, unknown>) => ({
      ...makeWorkspace("ws-1"),
      ...patch,
    }));

    const workspace = await createProviderBackedWorkspace(
      {
        workspaceService: {
          createStandalone: create,
          updateProviderProjection,
        },
        extensionRuntimeCatalog: {
          get: async () => ({
            runtime: {
              workspaceTypes: [
                {
                  id: "pocketcoder.remote",
                  provider: { create: mock(async () => providerResult), resolve: mock(async () => providerResult) },
                },
              ],
            },
          }),
        },
      } as never,
      {
        projectId: "project-1",
        providerId: "pocketcoder.remote",
        params: { repository: "repo" },
        standalone: true,
      },
    );

    expect(workspace.execution_kind).toBe("remote");
    expect(workspace.worktree_path).toBeNull();
    expect(workspace.provider_state).toBe("ready");
    expect(updateProviderProjection).toHaveBeenCalledWith(
      "ws-1",
      expect.objectContaining({
        execution_kind: "remote",
        worktree_path: null,
        display_path: "Pocket Coder remote-1",
      }),
    );
  });
});
