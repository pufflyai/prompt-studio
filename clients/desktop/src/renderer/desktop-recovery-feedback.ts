import type { PromptStudioDesktopApi } from "../desktop-api";
import type { DesktopState } from "../lifecycle/lifecycle-machine";

export type DesktopRecoveryAction = Extract<DesktopState, { kind: "recovery" }>["error"]["actions"][number];
type ActionStatus = "pending" | "failed";

export const createDesktopRecoveryFeedback = () => {
  let statuses: ReadonlyMap<DesktopRecoveryAction, ActionStatus> = new Map();
  const listeners = new Set<() => void>();
  const accept = (action: DesktopRecoveryAction, status?: ActionStatus) => {
    const next = new Map(statuses);
    if (status) next.set(action, status);
    else next.delete(action);
    statuses = next;
    for (const listener of listeners) listener();
  };

  return {
    snapshot: () => statuses,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async run(action: DesktopRecoveryAction, execute: () => Promise<void>) {
      if (statuses.get(action) === "pending") return;
      accept(action, "pending");
      try {
        await execute();
        accept(action);
      } catch {
        accept(action, "failed");
      }
    },
  };
};

export const observeDesktopStartupState = (
  bridge: Pick<PromptStudioDesktopApi, "getStartupState" | "onStartupState">,
  apply: (state: DesktopState) => void,
) => {
  let active = true;
  let receivedEvent = false;
  const stop = bridge.onStartupState((state) => {
    receivedEvent = true;
    if (active) apply(state);
  });
  void bridge.getStartupState().then(
    (state) => {
      if (active && !receivedEvent) apply(state);
    },
    () => {},
  );
  return () => {
    active = false;
    stop();
  };
};
