import { describe, expect, mock, test } from "bun:test";
import type { JsonObject, WorkspaceProviderResult } from "pstdio-api-contracts/extension-kernel";
import { makeWorkspace, remoteWorkspaceCapabilities } from "./workspace-provider.test-fixture";
import type { WorkspaceRecord } from "./workspace-provider-projection";
import { createProviderBackedWorkspace, normalizeResult } from "./workspace-provider-service";

const makeCreateDeps = (provider: Record<string, unknown>) => {
  let workspace = makeWorkspace({
    provider_ref_json: null,
    provider_state: "provisioning",
    provider_operation_id: "op-create-1",
    provider_operation_kind: "create",
  }) as WorkspaceRecord;
  const createStandalone = mock(async (input: Record<string, unknown>) => {
    workspace = { ...workspace, ...input };
    return workspace;
  });
  const updateProviderProjection = mock(async (_id: string, patch: Record<string, unknown>) => {
    workspace = { ...workspace, ...patch };
    return workspace;
  });
  const updateProviderOperationProjection = mock(
    async (_id: string, input: { operationId: string; operationKind: string; patch: Record<string, unknown> }) => {
      if (
        workspace.provider_operation_id !== input.operationId ||
        workspace.provider_operation_kind !== input.operationKind
      ) {
        return null;
      }
      workspace = { ...workspace, ...input.patch };
      return workspace;
    },
  );
  const beginProviderOperation = mock(
    async (
      _id: string,
      input: {
        operationId: string;
        kind: "cancel" | "archive" | "delete";
        state: "provisioning" | "archiving" | "deleting";
      },
    ) => {
      workspace = {
        ...workspace,
        provider_state: input.state,
        provider_operation_id: workspace.provider_operation_id ?? input.operationId,
        provider_operation_kind: input.kind,
      };
      return workspace;
    },
  );

  return {
    deps: {
      workspaceService: {
        createStandalone,
        updateProviderProjection,
        updateProviderOperationProjection,
        beginProviderOperation,
        get: async () => workspace,
      },
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
    beginProviderOperation,
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
    const { deps } = makeCreateDeps({
      create: mock(async () => providerResult),
      resolve: mock(async () => providerResult),
    });

    const workspace = await createProviderBackedWorkspace(deps, {
      projectId: "project-1",
      providerId: "pocketcoder.remote",
      params: { repository: "repo" },
      standalone: true,
    });

    expect(workspace).toMatchObject({
      execution_kind: "remote",
      worktree_path: null,
      provider_state: "ready",
      display_path: "Pocket Coder remote-1",
    });
  });

  test("keeps retry metadata when provider create throws", async () => {
    const { deps, createStandalone } = makeCreateDeps({
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

    expect(workspace).toMatchObject({
      provider_state: "failed",
      provider_operation_id: createStandalone.mock.calls[0]?.[0].provider_operation_id,
      provider_operation_kind: "create",
      provider_error_json: { retryable: true },
    });
  });

  test("resolves an accepted asynchronous create before returning it to session launch", async () => {
    const provisioning: WorkspaceProviderResult = {
      providerRef: { version: 1, data: { remoteId: "remote-1" } },
      state: "provisioning",
      executionKind: "remote",
      capabilities: remoteWorkspaceCapabilities,
    };
    const resolve = mock(async () => ({ ...provisioning, state: "ready" as const }));
    const { deps } = makeCreateDeps({ create: async () => provisioning, resolve });

    const workspace = await createProviderBackedWorkspace(deps, {
      projectId: "project-1",
      providerId: "pocketcoder.remote",
      standalone: true,
    });

    expect(resolve).toHaveBeenCalledTimes(1);
    expect(workspace.provider_state).toBe("ready");
  });

  test("hands a late create reference to a lifecycle operation without clearing ownership", async () => {
    const providerStarted = Promise.withResolvers<void>();
    const providerResult = Promise.withResolvers<WorkspaceProviderResult>();
    const ready: WorkspaceProviderResult = {
      providerRef: { version: 1, data: { remoteId: "remote-1" } },
      state: "ready",
      executionKind: "remote",
      capabilities: remoteWorkspaceCapabilities,
    };
    const { deps, beginProviderOperation, createStandalone } = makeCreateDeps({
      create: mock(async () => {
        providerStarted.resolve();
        return providerResult.promise;
      }),
    });

    const creating = createProviderBackedWorkspace(deps, {
      projectId: "project-1",
      providerId: "pocketcoder.remote",
      standalone: true,
    });
    await providerStarted.promise;
    await beginProviderOperation("ws-1", {
      operationId: "op-delete",
      kind: "delete",
      state: "deleting",
    });
    providerResult.resolve(ready);

    const workspace = await creating;
    expect(workspace).toMatchObject({
      provider_ref_json: ready.providerRef,
      provider_state: "deleting",
      provider_operation_id: createStandalone.mock.calls[0]?.[0].provider_operation_id,
      provider_operation_kind: "delete",
    });
  });

  test("keeps the create operation recoverable when an async provider omits its reference", async () => {
    const result: WorkspaceProviderResult = {
      state: "provisioning",
      executionKind: "remote",
      capabilities: remoteWorkspaceCapabilities,
    };
    const { deps, createStandalone } = makeCreateDeps({
      create: mock(async () => result),
      resolve: mock(async () => result),
    });

    const workspace = await createProviderBackedWorkspace(deps, {
      projectId: "project-1",
      providerId: "pocketcoder.remote",
      standalone: true,
    });

    expect(workspace).toMatchObject({
      provider_operation_id: createStandalone.mock.calls[0]?.[0].provider_operation_id,
      provider_operation_kind: "create",
      provider_state: "failed",
      provider_error_json: { code: "provider_ref_missing", retryable: true },
    });
  });

  test("keeps an aborted accepted create recoverable when its response is lost", async () => {
    const controller = new AbortController();
    const { deps, createStandalone } = makeCreateDeps({
      create: mock(async (_ctx: unknown, input: { signal?: AbortSignal }) => {
        await new Promise<void>((resolve) => input.signal?.addEventListener("abort", () => resolve(), { once: true }));
        throw new DOMException("The response was lost after acceptance.", "AbortError");
      }),
    });

    const creating = createProviderBackedWorkspace(deps, {
      projectId: "project-1",
      providerId: "pocketcoder.remote",
      standalone: true,
      signal: controller.signal,
    });
    await Bun.sleep(0);
    controller.abort();
    const workspace = await creating;

    expect(workspace).toMatchObject({
      provider_ref_json: null,
      provider_state: "provisioning",
      provider_operation_id: createStandalone.mock.calls[0]?.[0].provider_operation_id,
      provider_operation_kind: "cancel",
      provider_error_json: { retryable: true },
    });
  });

  test("does not settle an accepted create when the provider cannot clean up its resource", async () => {
    const controller = new AbortController();
    const result: WorkspaceProviderResult = {
      providerRef: { version: 1, data: { remoteId: "remote-1" } },
      state: "ready",
      executionKind: "remote",
      capabilities: remoteWorkspaceCapabilities,
    };
    const { deps, updateProviderProjection } = makeCreateDeps({
      create: mock(async () => {
        controller.abort();
        return result;
      }),
    });

    const workspace = await createProviderBackedWorkspace(deps, {
      projectId: "project-1",
      providerId: "pocketcoder.remote",
      standalone: true,
      signal: controller.signal,
    });

    expect(workspace).toMatchObject({
      provider_ref_json: result.providerRef,
      provider_state: "provisioning",
      provider_operation_kind: "cancel",
      provider_error_json: { retryable: true },
    });
    expect(updateProviderProjection.mock.calls.at(-1)?.[1]).toMatchObject({
      provider_ref_json: result.providerRef,
      provider_operation_kind: "cancel",
    });
  });
});

describe("normalizeResult", () => {
  test("keeps a remote create recoverable when a ready result omits its provider reference", () => {
    const normalized = normalizeResult("pocketcoder.remote", {
      state: "ready",
      executionKind: "remote",
      capabilities: remoteWorkspaceCapabilities,
    });

    expect(normalized).toMatchObject({
      provider_state: "failed",
      execution_kind: "remote",
      provider_error_json: { code: "provider_ref_missing", retryable: true },
    });
    expect(normalized).not.toHaveProperty("provider_operation_id");
  });

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

  test("rejects nested provider credential fields", () => {
    for (const data of [
      { authorization: "Bearer credential" },
      { nested: { clientSecret: "credential" } },
      { nested: { refresh_token: "credential" } },
      { nested: { secretAccessKey: "credential" } },
      { nested: { token: "credential" } },
    ] as JsonObject[]) {
      const normalized = normalizeResult("pocketcoder.remote", {
        providerRef: { version: 1, data },
        state: "ready",
        executionKind: "remote",
        capabilities: remoteWorkspaceCapabilities,
      });
      expect(normalized).toMatchObject({
        provider_state: "failed",
        provider_error_json: { code: "provider_result_contains_secret", retryable: false },
      });
      expect(normalized).not.toHaveProperty("provider_operation_id");
      expect(normalized).not.toHaveProperty("provider_operation_kind");
    }
  });

  test("rejects oversized provider references and errors", () => {
    const oversizedRef = normalizeResult("pocketcoder.remote", {
      providerRef: { version: 1, data: { value: "å".repeat(33_000) } },
      state: "ready",
      executionKind: "remote",
      capabilities: remoteWorkspaceCapabilities,
    });
    const oversizedError = normalizeResult("pocketcoder.remote", {
      providerRef: { version: 1, data: { remoteId: "remote-1" } },
      state: "failed",
      executionKind: "remote",
      capabilities: remoteWorkspaceCapabilities,
      error: { code: "remote_failure", message: "å".repeat(2_000), retryable: true },
    });

    expect(oversizedRef).toMatchObject({
      provider_state: "failed",
      provider_error_json: { code: "provider_result_too_large" },
    });
    expect(oversizedError).toMatchObject({
      provider_state: "failed",
      provider_error_json: { code: "provider_result_too_large" },
    });
  });

  test("rejects execution targets that disagree with their execution kind", () => {
    expect(
      normalizeResult("pocketcoder.remote", {
        providerRef: { version: 1, data: { remoteId: "remote-1" } },
        state: "ready",
        executionKind: "remote",
        executionTarget: { kind: "local", rootPath: "/tmp/not-remote" },
        capabilities: remoteWorkspaceCapabilities,
      }),
    ).toMatchObject({ provider_state: "failed", provider_error_json: { code: "provider_result_invalid" } });

    expect(
      normalizeResult("pocketcoder.local-provider", {
        state: "ready",
        executionKind: "local",
        capabilities: remoteWorkspaceCapabilities,
      }),
    ).toMatchObject({ provider_state: "failed", provider_error_json: { code: "provider_result_invalid" } });
  });
});
