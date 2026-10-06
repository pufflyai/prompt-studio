import type { RuntimeDescriptor } from "pstdio/runtime";
import type { DesktopRuntimeManager } from "../runtime/runtime-manager";
import {
  type DesktopRecoveryError,
  type DesktopState,
  type RuntimeActivity,
  transitionDesktopState,
} from "./lifecycle-machine";

type QuitFlowDeps = {
  runtimeManager: Pick<DesktopRuntimeManager, "detach" | "refreshRuntime" | "requestShutdown" | "waitForExit">;
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
  let quitting = false;

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

  const stopRuntimeAndQuit = async () => {
    const runtime = await deps.runtimeManager.refreshRuntime();
    if (!runtime || runtime.external || runtime.descriptor.ownerType === "persistent") {
      deps.runtimeManager.detach();
      await finishQuit();
      return;
    }

    const result = await deps.runtimeManager.requestShutdown(false);
    if (result.state === "active") {
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

  const confirmQuit = async () => {
    const state = deps.getState();
    if (state.kind !== "confirming_active_work") return;
    deps.setState(transitionDesktopState(state, { type: "quit_confirmed" }));

    try {
      await deps.showLifecycle();
      const result = await deps.runtimeManager.requestShutdown(true);
      if (result.state !== "accepted") throw new Error("Runtime refused graceful shutdown");
      await deps.runtimeManager.waitForExit();
      await finishQuit();
    } catch (error) {
      await showQuitFailure(error);
    }
  };

  const requestQuit = async () => {
    if (quitAllowed) return;
    const state = deps.getState();
    if (state.kind === "confirming_active_work") {
      if (await deps.askToCancelActiveWork(state.activity)) await confirmQuit();
      else await cancelQuit();
      return;
    }
    if (quitting) return;
    quitting = true;
    try {
      await stopRuntimeAndQuit();
    } catch (error) {
      await showQuitFailure(error);
    } finally {
      // A pending confirmation lives in the lifecycle state, so this flag only blocks a second
      // request while one is still running. Every outcome must free the next quit request.
      quitting = false;
    }
  };

  return { cancelQuit, confirmQuit, finishQuit, isQuitAllowed: () => quitAllowed, requestQuit };
};
