import type { DesktopActivity, DesktopLifecycleBridge, DesktopLifecycleState } from "@/lib/desktop-lifecycle-bridge";

export type DesktopQuitChoice = "keep-open" | "quit";

interface QuitDecision {
  activity: DesktopActivity | null;
  pending?: DesktopQuitChoice;
  error?: string;
  canCheck?: boolean;
}

interface QuitAttempt {
  error?: string;
}

const confirmation = (state: DesktopLifecycleState) =>
  state.kind === "confirming_active_work" ? (state.activity ?? null) : null;

const createDesktopQuitDecision = (bridge: DesktopLifecycleBridge) => {
  let snapshot: QuitDecision = { activity: null };
  let nativeRevision = 0;
  let subscriptionGeneration = 0;
  let stopNative: (() => void) | undefined;
  let active: QuitAttempt | undefined;
  let checking: QuitAttempt | undefined;
  const listeners = new Set<() => void>();
  const publish = (value: QuitDecision) => {
    snapshot = value;
    for (const listener of listeners) listener();
  };
  const observe = (state: DesktopLifecycleState) => {
    nativeRevision++;
    const activity = confirmation(state);
    if (!activity) active = undefined;
    publish(activity ? { ...snapshot, activity } : { activity: null });
  };
  const check = async () => {
    const attempt = active;
    if (!attempt || checking === attempt) return;
    checking = attempt;
    const before = nativeRevision;
    try {
      const state = await bridge.getStartupState();
      if (active !== attempt) return;
      active = undefined;
      const activity = before === nativeRevision ? confirmation(state) : snapshot.activity;
      publish(activity ? { activity, error: attempt.error } : { activity: null });
    } catch {
      if (active === attempt) {
        publish({
          ...snapshot,
          error: "The desktop response could not be confirmed.",
          canCheck: true,
        });
      }
    } finally {
      if (checking === attempt) checking = undefined;
    }
  };
  return {
    read: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (!stopNative) {
        stopNative = bridge.onStartupState(observe);
        const before = nativeRevision;
        const generation = subscriptionGeneration;
        void bridge.getStartupState().then(
          (state) => {
            if (before === nativeRevision && generation === subscriptionGeneration) observe(state);
          },
          () => {},
        );
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size) return;
        subscriptionGeneration++;
        stopNative?.();
        stopNative = undefined;
      };
    },
    check,
    async choose(choice: DesktopQuitChoice) {
      if (!snapshot.activity || active) return;
      const attempt: QuitAttempt = {};
      active = attempt;
      publish({ activity: snapshot.activity, pending: choice });
      try {
        if (choice === "quit") await bridge.confirmQuit();
        else await bridge.cancelQuit();
      } catch (error) {
        attempt.error = error instanceof Error ? error.message : String(error);
      }
      if (active === attempt) await check();
    },
  };
};

const decisions = new WeakMap<DesktopLifecycleBridge, ReturnType<typeof createDesktopQuitDecision>>();

export const getDesktopQuitDecision = (bridge: DesktopLifecycleBridge) => {
  let decision = decisions.get(bridge);
  if (!decision) {
    decision = createDesktopQuitDecision(bridge);
    decisions.set(bridge, decision);
  }
  return decision;
};
