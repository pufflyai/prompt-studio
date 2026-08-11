export type DesktopRuntimeIdentity = {
  instanceId: string;
  origin: `http://127.0.0.1:${number}`;
  ownerType: "desktop" | "persistent";
};

export type RuntimeActivity = {
  sessions: Array<{ id: string; label: string }>;
  terminals: Array<{ id: string; label: string }>;
  jobs: Array<{ id: string; label: string }>;
};

export type DesktopRecoveryCode =
  | "sidecar_missing"
  | "checksum_mismatch"
  | "invalid_manifest"
  | "invalid_permissions"
  | "target_mismatch"
  | "unsupported_target"
  | "version_mismatch"
  | "runtime_timeout"
  | "port_bind_failure"
  | "pglite_ownership_conflict"
  | "pglite_recovery_failure"
  | "runtime_ownership_uncertain"
  | "unexpected_exit";

export type DesktopRecoveryError = {
  code: DesktopRecoveryCode;
  message: string;
  actions: Array<"retry" | "open_logs" | "copy_diagnostics" | "quit">;
};

export type DesktopState =
  | { kind: "starting"; phase: "discovery" | "spawning" | "readiness" }
  | { kind: "workbench"; runtime: DesktopRuntimeIdentity }
  | { kind: "confirming_active_work"; runtime: DesktopRuntimeIdentity; activity: RuntimeActivity }
  | { kind: "closing" }
  | { kind: "recovery"; error: DesktopRecoveryError }
  | { kind: "detached" };

export type DesktopEvent =
  | { type: "runtime_missing" }
  | { type: "runtime_spawned" }
  | { type: "runtime_ready"; runtime: DesktopRuntimeIdentity }
  | { type: "quit_requested"; activity: RuntimeActivity | null }
  | { type: "quit_cancelled" }
  | { type: "quit_confirmed" }
  | { type: "runtime_exited"; intentional: boolean }
  | { type: "failed"; error: DesktopRecoveryError }
  | { type: "retry" };

export const initialDesktopState: DesktopState = { kind: "starting", phase: "discovery" };

const hasActivity = (activity: RuntimeActivity) =>
  activity.sessions.length > 0 || activity.terminals.length > 0 || activity.jobs.length > 0;

const unexpectedExitError = (): DesktopRecoveryError => ({
  code: "unexpected_exit",
  message: "The Prompt Studio runtime stopped unexpectedly.",
  actions: ["retry", "open_logs", "copy_diagnostics", "quit"],
});

const transitionStarting = (state: Extract<DesktopState, { kind: "starting" }>, event: DesktopEvent) => {
  if (event.type === "runtime_missing") return { kind: "starting", phase: "spawning" } as const;
  if (event.type === "runtime_spawned") return { kind: "starting", phase: "readiness" } as const;
  if (event.type === "runtime_ready") return { kind: "workbench", runtime: event.runtime } as const;
  return state;
};

const transitionWorkbench = (state: Extract<DesktopState, { kind: "workbench" }>, event: DesktopEvent) => {
  if (event.type !== "quit_requested") return state;
  if (state.runtime.ownerType === "persistent") return { kind: "detached" } as const;
  if (event.activity && hasActivity(event.activity)) {
    return { kind: "confirming_active_work", runtime: state.runtime, activity: event.activity } as const;
  }
  return { kind: "closing" } as const;
};

const transitionConfirmation = (
  state: Extract<DesktopState, { kind: "confirming_active_work" }>,
  event: DesktopEvent,
) => {
  if (event.type === "quit_cancelled") return { kind: "workbench", runtime: state.runtime } as const;
  if (event.type === "quit_confirmed") return { kind: "closing" } as const;
  return state;
};

export const transitionDesktopState = (state: DesktopState, event: DesktopEvent): DesktopState => {
  if (event.type === "failed") return { kind: "recovery", error: event.error };
  if (event.type === "retry" && state.kind === "recovery") return initialDesktopState;
  if (event.type === "runtime_exited") {
    return event.intentional ? { kind: "closing" } : { kind: "recovery", error: unexpectedExitError() };
  }
  if (state.kind === "starting") return transitionStarting(state, event);
  if (state.kind === "workbench") return transitionWorkbench(state, event);
  if (state.kind === "confirming_active_work") return transitionConfirmation(state, event);
  return state;
};
