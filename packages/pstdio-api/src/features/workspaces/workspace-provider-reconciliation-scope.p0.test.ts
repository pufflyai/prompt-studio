import { expect, test } from "bun:test";
import { makeWorkspace, remoteWorkspaceCapabilities } from "./workspace-provider.test-fixture";
import { reconcileProviderWorkspaces } from "./workspace-provider-reconciliation";

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
      listForProviderReconciliation: async () => workspaces,
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
      listForProviderReconciliation: async () => [workspace],
      updateProviderProjection: async (_id: string, patch: Record<string, unknown>) => Object.assign(workspace, patch),
    },
    workspaceProviderRuntime: {
      find: async () => enabled ? {
        context: {},
        provider: { resolve: async () => ({
          state: "ready", executionKind: "local", providerRef: reference,
          executionTarget: { kind: "local", rootPath: "/owned/workspace" },
          capabilities: { files: "write", diff: true, merge: true, rebase: true, delete: true },
        }) },
      } : undefined,
    },
  } as never;
  await reconcileProviderWorkspaces(deps, "project-1");
  expect(workspace).toMatchObject({ provider_state: "provider_missing", root_path: "/owned/workspace", provider_ref_json: reference });
  enabled = true;
  await reconcileProviderWorkspaces(deps, "project-1");
  expect(workspace).toMatchObject({ provider_state: "ready", root_path: "/owned/workspace", provider_ref_json: reference });
});
