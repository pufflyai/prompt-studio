import { describe, expect, test } from "bun:test";
import type { CommandDiagnostic } from "pstdio-api-contracts/extension-kernel";
import { createWorkspaceMaintenance } from "../../services/workspace-maintenance";
import {
  type ProvisionCoordinatorDeps,
  provisionProjectWorkspaces,
  removeProjectAfterProvisioning,
  runWorkspaceProvisioning,
  scheduleProjectWorkspaceProvisioning,
  type WorkspaceProvisioningHooks,
} from "./provision-coordinator";
import { makeWorkspace } from "./workspace-provider.test-fixture";

type Row = {
  id: string;
  initializing: boolean;
  setup_error: string | null;
  root_path: string | null;
  provider_id: string;
  provider_state: string;
  execution_kind: string;
};

const makeDeps = (row: Row) => {
  const calls: string[] = [];
  const deps = {
    workspaceService: {
      maintenance: createWorkspaceMaintenance(),
      get: async () => ({ ...row, project_id: "p1" }),
      getDefault: async () => ({
        id: "home",
        project_id: "project-1",
        root_path: "/repo",
        execution_kind: "local",
        provider_id: "pstdio.root",
        provider_state: "ready",
      }),
      list: async () => [row],
      setInitializing: async (_id: string, value: boolean) => {
        calls.push(`initializing:${value}`);
        row.initializing = value;
        return { ...row };
      },
      setSetupError: async (_id: string, message: string | null) => {
        calls.push(`setup_error:${message}`);
        row.setup_error = message;
        row.initializing = false;
        return { ...row };
      },
    },
  } as unknown as ProvisionCoordinatorDeps;
  return { deps, calls };
};

const makeHooks = (diagnostics: CommandDiagnostic[] | undefined, readyFired: string[]): WorkspaceProvisioningHooks => ({
  fireProvision: (async () => ({ delivered: 1, diagnostics })) as WorkspaceProvisioningHooks["fireProvision"],
  fireReadyAsync: ((_deps, _projectId, event) =>
    readyFired.push(typeof event === "string" ? event : event.id)) as WorkspaceProvisioningHooks["fireReadyAsync"],
  ensureConfig: async () => {},
});

describe("runWorkspaceProvisioning", () => {
  test("a provision request never returns a workspace outside its project", async () => {
    const workspace = makeWorkspace({ project_id: "p1", execution_kind: "local", root_path: "/accepted" });
    const { deps, calls } = makeDeps(workspace);
    deps.workspaceService.get = async () => ({ ...workspace, project_id: "other", root_path: "/other" });

    const result = await runWorkspaceProvisioning(
      deps,
      { projectId: "p1", workspace, repoPath: "/repo" },
      makeHooks(undefined, []),
    );

    expect(result).toEqual(workspace);
    expect(calls).toEqual([]);
  });

  test("gates initializing around an awaited provision, then clears it and fires ready", async () => {
    const row: Row = {
      provider_state: "ready",
      provider_id: "pstdio.worktree",
      execution_kind: "local",
      id: "ws-1",
      initializing: false,
      setup_error: null,
      root_path: "/wt",
    };
    const { deps, calls } = makeDeps(row);
    const readyFired: string[] = [];

    const result = await runWorkspaceProvisioning(
      deps,
      { projectId: "p1", workspace: row, repoPath: "/repo" },
      makeHooks(undefined, readyFired),
    );

    // A successful provision clears any prior setup error, which also marks the workspace ready.
    expect(calls).toEqual(["initializing:true", "setup_error:null"]);
    expect(result.initializing).toBe(false);
    expect(result.setup_error).toBeNull();
    expect(readyFired).toEqual(["workspace.ready"]);
  });

  test("clears a recovered setup error after a successful provision", async () => {
    const row: Row = {
      provider_state: "ready",
      provider_id: "pstdio.worktree",
      execution_kind: "local",
      id: "ws-1",
      initializing: false,
      setup_error: "old sync failure",
      root_path: "/wt",
    };
    const { deps, calls } = makeDeps(row);
    const readyFired: string[] = [];

    const result = await runWorkspaceProvisioning(
      deps,
      { projectId: "p1", workspace: row, repoPath: "/repo" },
      makeHooks(undefined, readyFired),
    );

    expect(calls).toEqual(["initializing:true", "setup_error:null"]);
    expect(result.initializing).toBe(false);
    expect(result.setup_error).toBeNull();
    expect(readyFired).toEqual(["workspace.ready"]);
  });

  test("sets setup_error and stops when a provision hook reports an error diagnostic", async () => {
    const row: Row = {
      provider_state: "ready",
      provider_id: "pstdio.worktree",
      execution_kind: "local",
      id: "ws-1",
      initializing: false,
      setup_error: null,
      root_path: "/wt",
    };
    const { deps, calls } = makeDeps(row);
    const readyFired: string[] = [];

    const diagnostic: CommandDiagnostic = {
      code: "sync_failed",
      message: "could not sync .claude/skills",
      severity: "error",
      extensionId: "harness-claude-code",
    };

    const result = await runWorkspaceProvisioning(
      deps,
      { projectId: "p1", workspace: row, repoPath: "/repo" },
      makeHooks([diagnostic], readyFired),
    );

    expect(result.setup_error).toBe("could not sync .claude/skills");
    // The lifecycle stops on error: ready never fires and initializing is not re-cleared.
    expect(calls).toEqual(["initializing:true", "setup_error:could not sync .claude/skills"]);
    expect(readyFired).toEqual([]);
  });

  test("treats a warning diagnostic (a thrown provision hook) as a setup failure", async () => {
    const row: Row = {
      provider_state: "ready",
      provider_id: "pstdio.worktree",
      execution_kind: "local",
      id: "ws-1",
      initializing: false,
      setup_error: null,
      root_path: "/wt",
    };
    const { deps, calls } = makeDeps(row);
    const readyFired: string[] = [];

    // The dispatcher reports a thrown hook as a hook_failed *warning*, not an error —
    // it must still block readiness, or a session boots with a half-synced agent dir.
    const diagnostic: CommandDiagnostic = {
      code: "hook_failed",
      message: 'Hook "provision" threw: ENOSPC',
      severity: "warning",
      extensionId: "harness-claude-code",
    };

    const result = await runWorkspaceProvisioning(
      deps,
      { projectId: "p1", workspace: row, repoPath: "/repo" },
      makeHooks([diagnostic], readyFired),
    );

    expect(result.setup_error).toBe('Hook "provision" threw: ENOSPC');
    expect(calls).toEqual(["initializing:true", 'setup_error:Hook "provision" threw: ENOSPC']);
    expect(readyFired).toEqual([]);
  });
});

describe("provisionProjectWorkspaces", () => {
  test("does not provision remote workspaces into the project repository", async () => {
    const row: Row = {
      id: "ws-remote",
      initializing: false,
      setup_error: null,
      root_path: null,
      provider_id: "pocketcoder.remote",
      provider_state: "ready",
      execution_kind: "remote",
    };
    const { deps, calls } = makeDeps(row);
    const ensured: string[] = [];
    const hooks = {
      ...makeHooks(undefined, []),
      ensureConfig: async (workspaceDir: string) => {
        ensured.push(workspaceDir);
      },
    };

    await provisionProjectWorkspaces(deps, "p1", hooks);

    expect(ensured).toEqual([]);
    expect(calls).toEqual([]);
  });

  test("schedules derived workspace sync without holding the caller open", async () => {
    const row: Row = {
      provider_state: "ready",
      provider_id: "pstdio.worktree",
      execution_kind: "local",
      id: "ws-1",
      initializing: false,
      setup_error: null,
      root_path: "/wt",
    };
    const { deps } = makeDeps(row);
    let releaseProvision: (() => void) | undefined;
    let finishProvision: (() => void) | undefined;
    const blocked = new Promise<void>((resolve) => {
      releaseProvision = resolve;
    });
    const finished = new Promise<void>((resolve) => {
      finishProvision = resolve;
    });
    const hooks: WorkspaceProvisioningHooks = {
      fireProvision: (async () => {
        await blocked;
        finishProvision?.();
        return { delivered: 1 };
      }) as WorkspaceProvisioningHooks["fireProvision"],
      fireReadyAsync: (() => {}) as WorkspaceProvisioningHooks["fireReadyAsync"],
      ensureConfig: async () => {},
    };

    expect(scheduleProjectWorkspaceProvisioning(deps, "p1", hooks)).toBeUndefined();

    releaseProvision?.();
    await finished;
  });

  test("serializes concurrent reprovisioning for the same project", async () => {
    const row: Row = {
      provider_state: "ready",
      provider_id: "pstdio.worktree",
      execution_kind: "local",
      id: "ws-1",
      initializing: false,
      setup_error: null,
      root_path: "/wt",
    };
    const { deps } = makeDeps(row);
    const events: string[] = [];
    let releaseFirst: (() => void) | undefined;
    const firstBlocked = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let call = 0;
    const hooks: WorkspaceProvisioningHooks = {
      fireProvision: (async () => {
        call += 1;
        const current = call;
        events.push(`start:${current}`);
        if (current === 1) await firstBlocked;
        events.push(`finish:${current}`);
        return { delivered: 1 };
      }) as WorkspaceProvisioningHooks["fireProvision"],
      fireReadyAsync: (() => {}) as WorkspaceProvisioningHooks["fireReadyAsync"],
      ensureConfig: async () => {},
    };

    const first = provisionProjectWorkspaces(deps, "p1", hooks);
    while (events.length === 0) await Promise.resolve();
    const second = provisionProjectWorkspaces(deps, "p1", hooks);
    await new Promise((resolve) => setImmediate(resolve));

    expect(events).toEqual(["start:1"]);

    releaseFirst?.();
    await Promise.all([first, second]);
    expect(events).toEqual(["start:1", "finish:1", "start:2", "finish:2"]);
  });

  test("records setup_error when a reprovision throws after setting initializing", async () => {
    const row: Row = {
      provider_state: "ready",
      provider_id: "pstdio.worktree",
      execution_kind: "local",
      id: "ws-1",
      initializing: false,
      setup_error: null,
      root_path: "/wt",
    };
    const { deps, calls } = makeDeps(row);
    const readyFired: string[] = [];

    const hooks = {
      ...makeHooks(undefined, readyFired),
      ensureConfig: async () => {
        throw new Error("config write failed");
      },
    };

    await provisionProjectWorkspaces(deps, "p1", hooks);

    expect(calls).toEqual(["setup_error:config write failed"]);
    expect(row.initializing).toBe(false);
    expect(row.setup_error).toBe("config write failed");
    expect(readyFired).toEqual([]);
  });
});

describe("removeProjectAfterProvisioning", () => {
  test("runs after the provisioning in flight and stops that pass before its remaining workspaces", async () => {
    const workspace = (id: string): Row => ({
      id,
      initializing: false,
      setup_error: null,
      root_path: `/repo/${id}`,
      provider_id: "pstdio.worktree",
      provider_state: "ready",
      execution_kind: "local",
    });
    const { deps } = makeDeps(workspace("first"));
    (deps.workspaceService as unknown as { list: () => Promise<Row[]> }).list = async () => [
      workspace("first"),
      workspace("second"),
    ];
    const order: string[] = [];
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const provisioning = provisionProjectWorkspaces(deps, "p1", {
      ...makeHooks(undefined, []),
      ensureConfig: async (dir) => {
        order.push(`config:${dir}`);
        entered.resolve();
        await release.promise;
      },
    });
    await entered.promise;

    const removal = removeProjectAfterProvisioning(deps, "p1", async () => {
      order.push("removed");
    });
    release.resolve();
    await Promise.all([provisioning, removal]);

    expect(order).toEqual(["config:/repo/first", "removed"]);
  });
});
