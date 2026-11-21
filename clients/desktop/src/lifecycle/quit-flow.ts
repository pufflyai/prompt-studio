import type { RuntimeDescriptor } from "pstdio/runtime";
import type { DesktopRuntimeManager } from "../runtime/runtime-manager";
import {
  type DesktopRecoveryError,
  type DesktopState,
  type RuntimeActivity,
  transitionDesktopState,
} from "./lifecycle-machine";

type QuitFlowDeps = {
  runtimeManager: Pick<
    DesktopRuntimeManager,
    "cancelStart" | "detach" | "refreshRuntime" | "requestShutdown" | "waitForExit"
  >;
  getState: () => DesktopState;
  setState: (state: DesktopState) => void;
  showLifecycle: () => Promise<void>;
  showQuitConfirmation: (descriptor: RuntimeDescriptor) => Promise<void>;
  /** Resolves true when the person chooses to cancel the active work and quit. */
  askToCancelActiveWork: (activity: RuntimeActivity) => Promise<boolean>;
  flushBeforeQuit: () => Promise<void>;
  quitApp: () => void;
  recoveryError: (error: unknown) => DesktopRecoveryError;
  logError: (error: unknown) => void;
};

export const createQuitFlow = (deps: QuitFlowDeps) => {
  let quitAllowed = false;
  let quitting: { active: boolean } | undefined;

  const finishQuit = async () => {
    // Losing the last saved layout is better than an app that cannot quit.
    await deps.flushBeforeQuit().catch(deps.logError);
    quitAllowed = true;
    deps.quitApp();
  };

  const showQuitFailure = async (error: unknown) => {
    deps.logError(error);
    deps.setState({ kind: "recovery", error: deps.recoveryError(error) });
    await deps.showLifecycle();
  };

  const runQuit = async (run: () => Promise<void>) => {
    if (quitting?.active || quitAllowed) return;
    const owner = { active: true };
    quitting = owner;
    try {
      await run();
    } catch (error) {
      if (quitAllowed || quitting !== owner) deps.logError(error);
      else await showQuitFailure(error);
    } finally {
      owner.active = false;
    }
  };

  const stopRuntimeAndQuit = async () => {
    await deps.runtimeManager.cancelStart();
    const runtime = await deps.runtimeManager.refreshRuntime();
    if (!runtime || runtime.external || runtime.descriptor.ownerType === "persistent") {
      await deps.runtimeManager.detach();
      await finishQuit();
      return;
    }

    const result = await deps.runtimeManager.requestShutdown(false);
    if (result.state === "active") {
      // The renderer can confirm while its window is still opening. Hand ownership
      // to that confirmation without letting this older request clear its guard.
      if (quitting) quitting.active = false;
      const { instanceId, origin, ownerType } = runtime.descriptor;
      deps.setState(
        transitionDesktopState(
          { kind: "workbench", runtime: { instanceId, origin, ownerType } },
          { type: "quit_requested", activity: result.activity },
        ),
      );
      await deps.showQuitConfirmation(runtime.descriptor);
      return;
    }
    if (result.state !== "accepted") throw new Error("Runtime refused graceful shutdown");

    deps.setState({ kind: "closing" });
    await deps.showLifecycle();
    await deps.runtimeManager.waitForExit();
    await finishQuit();
  };

  const cancelQuit = async () => {
    const state = deps.getState();
    if (state.kind !== "confirming_active_work") return;
    deps.setState(transitionDesktopState(state, { type: "quit_cancelled" }));
  };

  const stopConfirmedRuntime = async () => {
    const state = deps.getState();
    if (state.kind !== "confirming_active_work") return;
    deps.setState(transitionDesktopState(state, { type: "quit_confirmed" }));
    await deps.showLifecycle();
    const result = await deps.runtimeManager.requestShutdown(true);
    if (result.state !== "accepted") throw new Error("Runtime refused graceful shutdown");
    await deps.runtimeManager.waitForExit();
    await finishQuit();
  };

  const confirmQuit = () => runQuit(stopConfirmedRuntime);

  const requestQuit = async () => {
    if (quitAllowed || quitting?.active) return;
    const state = deps.getState();
    if (state.kind === "confirming_active_work") {
      return runQuit(async () => {
        if (await deps.askToCancelActiveWork(state.activity)) await stopConfirmedRuntime();
        else await cancelQuit();
      });
    }
    return runQuit(stopRuntimeAndQuit);
  };

  return {
    cancelQuit,
    confirmQuit,
    finishQuit,
    isQuitAllowed: () => quitAllowed,
    isQuitting: () => Boolean(quitting?.active) || quitAllowed,
    requestQuit,
  };
};
