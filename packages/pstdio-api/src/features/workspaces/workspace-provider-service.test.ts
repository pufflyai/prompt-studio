import { describe, expect, mock, test } from "bun:test";
import type { WorkspaceProviderResult } from "pstdio-api-contracts/extension-kernel";
import { makeWorkspace, remoteWorkspaceCapabilities } from "./workspace-provider.test-fixture";
import {
  createProviderBackedWorkspace,
  normalizeResult,
  resolveWorkspaceExecutionTarget,
} from "./workspace-provider-service";

const makeCreateDeps = (provider: Record<string, unknown>) => {
  let workspace = makeWorkspace({
    provider_ref_json: null,
    provider_state: "provisioning",
    provider_operation_id: "op-create-1",
    provider_operation_kind: "create",
  });
  const createStandalone = mock(async (input: Record<string, unknown>) => {
    workspace = { ...workspace, ...input };
    return workspace;
  });
  const updateProviderProjection = mock(async (_id: string, patch: Record<string, unknown>) => {
    workspace = { ...workspace, ...patch };
    return workspace;
  });

  return {
    deps: {
      workspaceService: { createStandalone, updateProviderProjection },
      workspaceProviderRuntime: {
        find: async () => ({ context: {} as never, provider: provider as never }),
      },
      extensionRuntimeCatalog: {
        get: async () => ({
          project: { id: "project-1", name: "Project", shorthand: "PS" },
          enabledSources: [],
          runtime: {
            workspaceTypes: [{ id: "pocketcoder.remote", extensionId: "pocketcoder", name: "remote", provider }],
          },
        }),
      },
    } as never,
    createStandalone,
    updateProviderProjection,
  };
};

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
    const { deps, updateProviderProjection } = makeCreateDeps({
      create: mock(async () => providerResult),
      resolve: mock(async () => providerResult),
    });

    const workspace = await createProviderBackedWorkspace(deps, {
      projectId: "project-1",
      providerId: "pocketcoder.remote",
      params: { repository: "repo" },
      standalone: true,
    });

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

  test("keeps retry metadata when provider create throws", async () => {
    const { deps, createStandalone, updateProviderProjection } = makeCreateDeps({
      create: mock(async () => {
        throw new Error("remote API unavailable");
      }),
      resolve: mock(async () => {
        throw new Error("unused");
      }),
    });

    const workspace = await createProviderBackedWorkspace(deps, {
      projectId: "project-1",
      providerId: "pocketcoder.remote",
      standalone: true,
    });

    expect(workspace.provider_state).toBe("failed");
    expect(updateProviderProjection.mock.calls.at(-1)?.[1]).toMatchObject({
      provider_operation_id: createStandalone.mock.calls[0]?.[0].provider_operation_id,
      provider_operation_kind: "create",
      provider_error_json: { retryable: true },
    });
  });

  test("keeps the create operation when an async provider has no reference yet", async () => {
    const result: WorkspaceProviderResult = {
      state: "provisioning",
      executionKind: "remote",
      capabilities: remoteWorkspaceCapabilities,
    };
    const { deps, createStandalone, updateProviderProjection } = makeCreateDeps({
      create: mock(async () => result),
      resolve: mock(async () => result),
    });

    const workspace = await createProviderBackedWorkspace(deps, {
      projectId: "project-1",
      providerId: "pocketcoder.remote",
      standalone: true,
    });

    expect(updateProviderProjection.mock.calls.at(-1)?.[1]).not.toHaveProperty("provider_operation_id");
    expect(workspace).toMatchObject({
      provider_operation_id: createStandalone.mock.calls[0]?.[0].provider_operation_id,
      provider_operation_kind: "create",
      provider_state: "provisioning",
    });
  });
});

describe("normalizeResult", () => {
  test("reads branch from the declared result field and leaves opaque provider refs alone", () => {
    const normalized = normalizeResult("pocketcoder.remote", {
      branch: "remote/WS-1",
      providerRef: {
        version: 1,
        data: { branch: "provider-owned-value", page_token: "next-page", client_credential_id: "public-id" },
      },
      state: "ready",
      executionKind: "remote",
      capabilities: remoteWorkspaceCapabilities,
    });

    expect(normalized.branch).toBe("remote/WS-1");
    expect(normalized.provider_ref_json).toEqual({
      version: 1,
      data: { branch: "provider-owned-value", page_token: "next-page", client_credential_id: "public-id" },
    });
    expect(normalized.provider_state).toBe("ready");
  });

  test("handles cyclic provider values without overflowing", () => {
    const data: Record<string, unknown> = {};
    data.self = data;

    expect(() =>
      normalizeResult("pocketcoder.remote", {
        providerRef: { version: 1, data: data as never },
        state: "ready",
        executionKind: "remote",
        capabilities: remoteWorkspaceCapabilities,
      }),
    ).not.toThrow();
  });
});

describe("resolveWorkspaceExecutionTarget", () => {
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
