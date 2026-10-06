import { waitForWorkspaceReady } from "../workspaces/wait-for-ready";
import type { SessionsRouteDeps } from "./deps";
import { toHarnessWorkspaceContext } from "./session-workspace-context";

type WorkspaceReadyDeps = { workspaceSessionService?: SessionsRouteDeps["workspaceSessionService"] };

export class WorkspaceSessionNotReadyError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

// Hard gate shared by every harness entrypoint (start, resume, reattach): a worktree must
// finish syncing its `.claude/skills` before the harness boots, or skills read as "Unknown".
// Resume and reattach can land mid re-sync just like a fresh start, so all three wait here —
// including the startup orphan-recovery path, whose deps now carry `workspaceSessionService`
// so reattach enforces the gate instead of bypassing it.
// If provisioning is still running past the cap, or it failed (which clears `initializing` but
// records `setup_error`), fail loudly instead of launching into a half-synced tree.
const ensureWorkspaceReady = async (deps: WorkspaceReadyDeps, sessionId: string) => {
  if (!deps.workspaceSessionService) return null;

  const workspace = await waitForWorkspaceReady({ workspaceSessionService: deps.workspaceSessionService }, sessionId);
  if (workspace?.initializing) {
    throw new WorkspaceSessionNotReadyError(
      `Workspace ${workspace.id} is still provisioning; refusing to start the session.`,
      true,
    );
  }
  if (workspace?.setup_error) {
    throw new WorkspaceSessionNotReadyError(
      `Workspace ${workspace.id} failed to provision: ${workspace.setup_error}`,
      false,
    );
  }
  if (workspace?.provider_state && workspace.provider_state !== "ready") {
    const message = workspace.provider_error_json?.message ?? `provider state is ${workspace.provider_state}`;
    const retryable =
      workspace.provider_error_json?.retryable === true ||
      workspace.provider_state === "provisioning" ||
      workspace.provider_state === "provider_missing";
    throw new WorkspaceSessionNotReadyError(`Workspace ${workspace.id} is not ready: ${message}`, retryable);
  }
  return workspace;
};

export const resolveHarnessWorkspace = async (
  deps: WorkspaceReadyDeps,
  input: { sessionId: string; cwd?: string },
  harness: { cwdRequirement: "required" | "optional" },
) => {
  const workspace = await ensureWorkspaceReady(deps, input.sessionId);
  const context = toHarnessWorkspaceContext(workspace, input.cwd);
  if (workspace?.execution_kind === "remote" && harness.cwdRequirement === "required") {
    throw new Error(`Harness requires a local cwd and cannot run remote workspace ${workspace.id}.`);
  }
  return context;
};
