import { expect, test } from "bun:test";
import { createWorkspaceMaintenance } from "../../services/workspace-maintenance";
import type { WorkspacesRouteDeps } from "./deps";
import { makeWorkspace, remoteWorkspaceCapabilities } from "./workspace-provider.test-fixture";
import { removeProviderWorkspaceBacking } from "./workspace-provider-lifecycle";
import { reconcileProviderWorkspaces } from "./workspace-provider-reconciliation";
import { makeDeps } from "./workspace-provider-reconciliation.fixture";

type ReconciledInput = {
  operationId: string | null;
  operationKind: string | null;
  expectedState?: string;
  patch: Record<string, unknown>;
};

test("targeted recovery skips pending siblings while background recovery still includes them", async () => {
  const workspaces = [makeWorkspace({ id: "home" }), makeWorkspace({ id: "other", provider_state: "provisioning" })];
  const resolved: string[] = [];
  const provider = {
    resolve: async (_context: unknown, input: { workspaceId: string }) => {
      resolved.push(input.workspaceId);
      return {
        providerRef: { version: 1, data: { remoteId: input.workspaceId } },
        state: input.workspaceId === "home" ? "ready" : "provisioning",
        executionKind: "remote",
        capabilities: remoteWorkspaceCapabilities,
      };
    },
  };
  const deps = {
    workspaceService: {
      maintenance: createWorkspaceMaintenance(),
      get: async (id: string) => workspaces.find((workspace) => workspace.id === id) ?? null,
      listForProviderReconciliation: async () => workspaces,
      updateProviderOperationProjection: async (id: string, input: ReconciledInput) => {
        const workspace = workspaces.find((candidate) => candidate.id === id)!;
        if (
          workspace.provider_state !== input.expectedState ||
          workspace.provider_operation_id !== input.operationId ||
          workspace.provider_operation_kind !== input.operationKind
        )
          return null;
        return Object.assign(workspace, input.patch);
      },
      updateProviderProjection: async (id: string, patch: Record<string, unknown>) => {
        const workspace = workspaces.find((candidate) => candidate.id === id)!;
        Object.assign(workspace, patch);
        return workspace;
      },
    },
    workspaceProviderRuntime: { find: async () => ({ context: {}, provider }) },
  } as never;

  await reconcileProviderWorkspaces(deps, "project-1", {
    workspaceId: "home",
    retryUntilReadyMs: 25,
    retryDelayMs: 1,
  });
  expect(resolved).toEqual(["home"]);
  expect(workspaces[1]).toMatchObject({ provider_state: "provisioning" });

  await reconcileProviderWorkspaces(deps, "project-1");
  expect(resolved).toEqual(["home", "home", "other"]);
});

test("a ready local provider becomes unavailable without losing its target and recovers when enabled", async () => {
  const workspace = makeWorkspace({ execution_kind: "local", root_path: "/owned/workspace", provider_state: "ready" });
  const reference = workspace.provider_ref_json;
  let enabled = false;
  const deps = {
    workspaceService: {
      maintenance: createWorkspaceMaintenance(),
      get: async () => workspace,
      listForProviderReconciliation: async () => [{ ...workspace }],
      updateProviderOperationProjection: async (_id: string, input: ReconciledInput) => {
        if (
          workspace.provider_state !== input.expectedState ||
          workspace.provider_operation_id !== input.operationId ||
          workspace.provider_operation_kind !== input.operationKind
        )
          return null;
        return Object.assign(workspace, input.patch);
      },
      updateProviderProjection: async (_id: string, patch: Record<string, unknown>) => Object.assign(workspace, patch),
    },
    workspaceProviderRuntime: {
      find: async () =>
        enabled
          ? {
              context: {},
              provider: {
                resolve: async () => ({
                  state: "ready",
                  executionKind: "local",
                  providerRef: reference,
                  executionTarget: { kind: "local", rootPath: "/owned/workspace" },
                  capabilities: { files: "write", diff: true, merge: true, rebase: true, delete: true },
                }),
              },
            }
          : undefined,
    },
  } as never;
  await reconcileProviderWorkspaces(deps, "project-1");
  expect(workspace).toMatchObject({
    provider_state: "provider_missing",
    root_path: "/owned/workspace",
    provider_ref_json: reference,
  });
  enabled = true;
  await reconcileProviderWorkspaces(deps, "project-1");
  expect(workspace).toMatchObject({
    provider_state: "ready",
    root_path: "/owned/workspace",
    provider_ref_json: reference,
  });
});

test("a late ready resolution cannot overwrite a provider disabled during the callback", async () => {
  const workspace = makeWorkspace({ execution_kind: "local", root_path: "/owned/workspace", provider_state: "ready" });
  const started = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let enabled = true;
  const provider = {
    resolve: async () => {
      started.resolve();
      await release.promise;
      return {
        state: "ready",
        executionKind: "local",
        providerRef: workspace.provider_ref_json,
        executionTarget: { kind: "local", rootPath: "/owned/workspace" },
        capabilities: remoteWorkspaceCapabilities,
      };
    },
  };
  const deps = {
    workspaceService: {
      maintenance: createWorkspaceMaintenance(),
      get: async () => workspace,
      listForProviderReconciliation: async () => [{ ...workspace }],
      updateProviderOperationProjection: async (_id: string, input: ReconciledInput) => {
        if (
          workspace.provider_state !== input.expectedState ||
          workspace.provider_operation_id !== input.operationId ||
          workspace.provider_operation_kind !== input.operationKind
        )
          return null;
        return Object.assign(workspace, input.patch);
      },
      updateProviderProjection: async (_id: string, patch: Record<string, unknown>) => Object.assign(workspace, patch),
    },
    workspaceProviderRuntime: { find: async () => (enabled ? { context: {}, provider } : undefined) },
  } as never;
  const initial = reconcileProviderWorkspaces(deps, "project-1");
  await started.promise;
  enabled = false;
  const disabled = reconcileProviderWorkspaces(deps, "project-1");
  release.resolve();
  await Promise.all([initial, disabled]);
  expect(workspace).toMatchObject({ provider_state: "provider_missing", root_path: "/owned/workspace" });
});

test("a late ready resolution cannot restore backing removed by a newer lifecycle operation", async () => {
  const workspace = makeWorkspace({
    execution_kind: "local",
    root_path: "/owned/workspace",
    branch: "workspace/WS-1",
    provider_state: "ready",
    provider_operation_id: null,
    provider_operation_kind: null,
  });
  const started = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const { deps, getWorkspace } = makeDeps(
    {
      resolve: async () => {
        started.resolve();
        await release.promise;
        return {
          state: "ready",
          executionKind: "local",
          providerRef: workspace.provider_ref_json,
          executionTarget: { kind: "local", rootPath: "/owned/workspace" },
          capabilities: remoteWorkspaceCapabilities,
        };
      },
      delete: async () => {},
    },
    workspace,
  );
  const initial = reconcileProviderWorkspaces(deps, "project-1");
  await started.promise;
  await removeProviderWorkspaceBacking(deps, workspace);
  release.resolve();
  await initial;
  expect(await getWorkspace()).toMatchObject({
    provider_state: "cancelled",
    root_path: null,
    branch: null,
    provider_operation_kind: null,
  });
});

test("queued restart recovery preserves a workspace cancelled while it waits for maintenance", async () => {
  const workspace = makeWorkspace({ execution_kind: "local", root_path: "/owned/workspace" });
  let resolutions = 0;
  const { deps, getWorkspace } = makeDeps(
    {
      resolve: async () => {
        resolutions++;
        return {
          state: "ready",
          executionKind: "local",
          providerRef: workspace.provider_ref_json,
          executionTarget: { kind: "local", rootPath: "/owned/workspace" },
          capabilities: remoteWorkspaceCapabilities,
        };
      },
      delete: async () => {},
    },
    workspace,
  );
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const discovered = Promise.withResolvers<void>();
  const service = (deps as WorkspacesRouteDeps).workspaceService;
  const maintenance = service.maintenance.run(workspace.id, async () => {
    entered.resolve();
    await release.promise;
  });
  await entered.promise;
  const run = service.maintenance.runExclusive;
  service.maintenance.runExclusive = (id, work) => {
    discovered.resolve();
    return run(id, work);
  };
  const recovery = reconcileProviderWorkspaces(deps, "project-1");
  try {
    await discovered.promise;
    await removeProviderWorkspaceBacking(deps, workspace);
    release.resolve();
    await Promise.all([maintenance, recovery]);
    expect(resolutions).toBe(0);
    expect(await getWorkspace()).toMatchObject({ provider_state: "cancelled", root_path: null, branch: null });
  } finally {
    release.resolve();
    await Promise.allSettled([maintenance, recovery]);
  }
});
