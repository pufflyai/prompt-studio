import { describe, expect, test } from "bun:test";
import type { WorkspaceProvisionPayload } from "pstdio-api-contracts/extension-kernel";
import {
  type ProvisionCoordinatorDeps,
  provisionProjectWorkspaces,
  runWorkspaceProvisioning,
  type WorkspaceProvisioningHooks,
} from "./provision-coordinator";
import { makeWorkspace } from "./workspace-provider.test-fixture";

const setup = (home: ReturnType<typeof makeWorkspace> | null = null) => {
  let workspace: Omit<ReturnType<typeof makeWorkspace>, "setup_error"> & { setup_error: string | null } = makeWorkspace(
    {
      provider_id: "example.local",
      execution_kind: "local",
      worktree_path: "/provider/workspace",
      setup_error: "Previous failure",
    },
  );
  const payloads: WorkspaceProvisionPayload[] = [];
  const configured: string[] = [];
  let ready = 0;
  const deps = {
    workspaceService: {
      getDefault: async () => home,
      list: async () => [workspace],
      setInitializing: async (_id: string, initializing: boolean) => (workspace = { ...workspace, initializing }),
      setSetupError: async (_id: string, setup_error: string | null) =>
        (workspace = { ...workspace, setup_error, initializing: false }),
    },
    repoService: { listByProject: async () => [] },
  } as unknown as ProvisionCoordinatorDeps;
  const hooks: WorkspaceProvisioningHooks = {
    ensureConfig: async (directory) => {
      configured.push(directory);
    },
    fireProvision: async (_deps, _projectId, _event, payload) => {
      payloads.push(payload as WorkspaceProvisionPayload);
      return { delivered: 1 };
    },
    fireReadyAsync: () => {
      ready++;
    },
  };
  return {
    deps,
    hooks,
    payloads,
    configured,
    get workspace() {
      return workspace;
    },
    get ready() {
      return ready;
    },
    create: () =>
      runWorkspaceProvisioning(
        deps,
        {
          projectId: "project-1",
          workspace,
          repoPath: "/provider/workspace",
        },
        hooks,
      ),
  };
};

describe("provider-owned local provisioning", () => {
  for (const home of [null, makeWorkspace({ id: "home", is_default: true })]) {
    test(`creates a local target with ${home ? "a remote" : "no"} default workspace`, async () => {
      const fixture = setup(home);
      const result = await fixture.create();
      expect(result).toMatchObject({ initializing: false, setup_error: null });
      expect(fixture.payloads).toHaveLength(1);
      expect(fixture.payloads[0]).toMatchObject({
        workspaceDir: "/provider/workspace",
        providerId: "example.local",
      });
      expect(fixture.payloads[0]?.projectDir).toBeUndefined();
      expect(fixture.configured).toEqual(["/provider/workspace"]);
      expect(fixture.ready).toBe(1);
    });
  }

  test("catalog changes reprovision a recorded local target without linked repositories", async () => {
    const fixture = setup();
    await provisionProjectWorkspaces(fixture.deps, "project-1", fixture.hooks);
    expect(fixture.payloads).toHaveLength(1);
    expect(fixture.workspace).toMatchObject({ initializing: false, setup_error: null });
    expect(fixture.ready).toBe(0);
  });

  for (const stage of ["location", "config", "dispatch"] as const) {
    test(`a thrown ${stage} failure settles readiness and permits retry`, async () => {
      const fixture = setup(makeWorkspace({ execution_kind: "local", worktree_path: "/home" }));
      const failure = new Error(`${stage} unavailable`);
      const getDefault = fixture.deps.workspaceService.getDefault;
      const ensureConfig = fixture.hooks.ensureConfig;
      const fireProvision = fixture.hooks.fireProvision;
      if (stage === "location")
        fixture.deps.workspaceService.getDefault = async () => {
          throw failure;
        };
      if (stage === "config")
        fixture.hooks.ensureConfig = async () => {
          throw failure;
        };
      if (stage === "dispatch")
        fixture.hooks.fireProvision = async () => {
          throw failure;
        };
      expect(await fixture.create()).toMatchObject({ initializing: false, setup_error: failure.message });
      expect(fixture.ready).toBe(0);
      fixture.deps.workspaceService.getDefault = getDefault;
      fixture.hooks.ensureConfig = ensureConfig;
      fixture.hooks.fireProvision = fireProvision;
      expect(await fixture.create()).toMatchObject({ initializing: false, setup_error: null });
      expect(fixture.ready).toBe(1);
    });
  }
});
