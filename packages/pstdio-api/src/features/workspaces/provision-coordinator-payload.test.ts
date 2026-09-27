import { describe, expect, test } from "bun:test";
import type { WorkspaceProvisionPayload } from "pstdio-api-contracts/extension-kernel";
import {
  type ProvisionCoordinatorDeps,
  runWorkspaceProvisioning,
  type WorkspaceProvisioningHooks,
} from "./provision-coordinator";
import { makeWorkspace } from "./workspace-provider.test-fixture";

const provision = async (workspace: ReturnType<typeof makeWorkspace>) => {
  const payloads: WorkspaceProvisionPayload[] = [];
  const configured: string[] = [];
  const home = makeWorkspace({
    id: "home",
    is_default: true,
    provider_id: "pstdio.root",
    execution_kind: "local",
    root_path: "/project-home",
    setup_error: "Previous setup failed",
  });
  const deps = {
    workspaceService: {
      getDefault: async () => home,
      setInitializing: async (_id: string, initializing: boolean) => ({ ...workspace, initializing }),
      setSetupError: async (_id: string, setup_error: string | null) => ({
        ...workspace,
        setup_error,
        initializing: false,
      }),
    },
  } as unknown as ProvisionCoordinatorDeps;
  const hooks: WorkspaceProvisioningHooks = {
    fireProvision: async (_deps, _projectId, _event, payload) => {
      payloads.push(payload as WorkspaceProvisionPayload);
      return { delivered: 1 };
    },
    fireReadyAsync: (_deps, _projectId, _event, payload) => {
      payloads.push(payload as WorkspaceProvisionPayload);
    },
    ensureConfig: async (directory) => {
      configured.push(directory);
    },
  };
  await runWorkspaceProvisioning(deps, { projectId: "p1", workspace, repoPath: "/other-repo" }, hooks);
  return { payloads, configured };
};

describe("workspace provisioning locations", () => {
  test.each([
    { providerId: "pstdio.worktree", worktreePath: "/other-repo/.worktrees/attempt", type: "worktree" },
    { providerId: "pstdio.root", worktreePath: "/other-repo", type: "root" },
  ])("emits project and workspace locations for the $type provider", async ({ providerId, worktreePath }) => {
    const workspace = makeWorkspace({ provider_id: providerId, execution_kind: "local", root_path: worktreePath });
    const { payloads, configured } = await provision(workspace);
    const workspaceDir = worktreePath ?? "/other-repo";

    expect(payloads).toHaveLength(2);
    for (const payload of payloads) {
      expect(payload).toMatchObject({
        projectDir: "/project-home",
        providerId,
        workspaceDir,
        workspace: { id: workspace.id, root_path: workspaceDir },
      });
    }
    expect(configured).toEqual([workspaceDir]);
  });

  test("does not materialize a remote provider into a local repository", async () => {
    const { payloads, configured } = await provision(
      makeWorkspace({
        provider_id: "cloud.environment",
        execution_kind: "remote",
        root_path: null,
      }),
    );

    expect(payloads).toEqual([]);
    expect(configured).toEqual([]);
  });
});
