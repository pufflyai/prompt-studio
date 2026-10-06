import type { WorkspaceRecord } from "./workspace-provider-projection";

type ReadinessWorkspace = Pick<
  WorkspaceRecord,
  "id" | "initializing" | "setup_error" | "provider_state" | "provider_error_json"
>;

// The one rule for whether a session may start in its workspace. The queue drain and the spawn
// gate both read it, so the drain never dispatches work that the spawn gate would send back.
// `wait` clears on its own (the workspace `set` event drains the queue again); `fail` does not.
export const workspaceSessionReadiness = (workspace: ReadinessWorkspace | null | undefined) => {
  if (!workspace) return { kind: "ready" } as const;
  if (workspace.initializing) {
    return { kind: "wait", message: `Workspace ${workspace.id} is still provisioning.` } as const;
  }
  if (workspace.setup_error) {
    return {
      kind: "fail",
      message: `Workspace ${workspace.id} failed to provision: ${workspace.setup_error}`,
    } as const;
  }
  const state = workspace.provider_state;
  if (state === "ready") return { kind: "ready" } as const;

  const message = `Workspace ${workspace.id} is not ready: ${workspace.provider_error_json?.message ?? `provider state is ${state}`}`;
  const retryable =
    workspace.provider_error_json?.retryable === true || state === "provisioning" || state === "provider_missing";
  return { kind: retryable ? "wait" : "fail", message } as const;
};
