import { describe, expect, test } from "bun:test";
import type { CommandDiagnostic } from "pstdio-api-contracts/extension-kernel";
import {
  type ProvisionCoordinatorDeps,
  runWorkspaceProvisioning,
  type WorkspaceProvisioningHooks,
} from "./provision-coordinator";

type Row = { id: string; initializing: boolean; setup_error: string | null; worktree_path: string | null };

const makeDeps = (row: Row) => {
  const calls: string[] = [];
  const deps = {
    workspaceService: {
      setInitializing: async (_id: string, value: boolean) => {
        calls.push(`initializing:${value}`);
        row.initializing = value;
        return { ...row };
      },
      setSetupError: async (_id: string, message: string) => {
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
  test("gates initializing around an awaited provision, then clears it and fires ready", async () => {
    const row: Row = { id: "ws-1", initializing: false, setup_error: null, worktree_path: "/wt" };
    const { deps, calls } = makeDeps(row);
    const readyFired: string[] = [];

    const result = await runWorkspaceProvisioning(
      deps,
      { projectId: "p1", workspace: row, repoPath: "/repo" },
      makeHooks(undefined, readyFired),
    );

    // initializing is set true (awaited provision) then false before returning.
    expect(calls).toEqual(["initializing:true", "initializing:false"]);
    expect(result.initializing).toBe(false);
    expect(result.setup_error).toBeNull();
    expect(readyFired).toEqual(["workspace.ready"]);
  });

  test("sets setup_error and stops when a provision hook reports an error diagnostic", async () => {
    const row: Row = { id: "ws-1", initializing: false, setup_error: null, worktree_path: "/wt" };
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
    const row: Row = { id: "ws-1", initializing: false, setup_error: null, worktree_path: "/wt" };
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
