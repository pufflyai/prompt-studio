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
