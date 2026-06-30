import type { RouteDeps } from "../deps";

type WaitForReadyDeps = Pick<RouteDeps, "workspaceSessionService">;

// Provisioning is fast (local file copies), so a long cap means a genuinely stuck
// hook — which we surface as a launch failure rather than boot a half-synced tree.
const WORKSPACE_READY_TIMEOUT_MS = 60_000;
const WORKSPACE_READY_POLL_MS = 25;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type WaitOptions = { timeoutMs?: number; pollMs?: number };

// Awaited provisioning sets `initializing` while harness hooks sync their dirs.
// Sessions must not spawn until it clears so a worktree never launches with a
// half-copied `.claude/skills` (the "Unknown skill" race). Returns the latest
// workspace; callers must reject launch if it is still `initializing`.
export const waitForWorkspaceReady = async (deps: WaitForReadyDeps, sessionId: string, options?: WaitOptions) => {
  const timeoutMs = options?.timeoutMs ?? WORKSPACE_READY_TIMEOUT_MS;
  const pollMs = options?.pollMs ?? WORKSPACE_READY_POLL_MS;

  let workspace = await deps.workspaceSessionService.getWorkspaceBySessionId(sessionId);
  const deadline = Date.now() + timeoutMs;

  while (workspace?.initializing && Date.now() < deadline) {
    await wait(pollMs);
    workspace = await deps.workspaceSessionService.getWorkspaceBySessionId(sessionId);
  }

  return workspace;
};
