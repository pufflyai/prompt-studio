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
  let quitting: { active: boolean; waitingForConfirmation: boolean } | undefined;

  const finishQuit = async () => {
    // Losing the last saved layout is better than an app that cannot quit.
    await deps.flushBeforeQuit().catch(deps.logError);
    quitAllowed = true;
    deps.quitApp();
  };

  const showQuitFailure = async (error: unknown) => {
    deps.logError(error);
    deps.setState({ kind: "recovery", error: deps.recoveryError(error) });
    await deps.showLifecycle().catch(deps.logError);
  };

  const runQuit = async (run: () => Promise<void>, waitingForConfirmation = false) => {
    if (quitting?.active || quitAllowed) return;
    const initialState = deps.getState();
    const owner = { active: true, waitingForConfirmation };
    quitting = owner;
    try {
      await run();
    } catch (error) {
      if (quitAllowed || quitting !== owner || (owner.waitingForConfirmation && deps.getState() !== initialState))
        deps.logError(error);
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
      const confirmation = transitionDesktopState(
        { kind: "workbench", runtime: { instanceId, origin, ownerType } },
        { type: "quit_requested", activity: result.activity },
      );
      deps.setState(confirmation);
      try {
        await deps.showQuitConfirmation(runtime.descriptor);
      } catch (error) {
        deps.logError(error);
        if (confirmation.kind === "confirming_active_work" && deps.getState() === confirmation) await requestQuit();
      }
      return;
    }
    if (result.state !== "accepted") throw new Error("Runtime refused graceful shutdown");

    deps.setState({ kind: "closing" });
    await deps.showLifecycle().catch(deps.logError);
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
    await deps.showLifecycle().catch(deps.logError);
    const result = await deps.runtimeManager.requestShutdown(true);
    if (result.state !== "accepted") throw new Error("Runtime refused graceful shutdown");
    await deps.runtimeManager.waitForExit();
    await finishQuit();
  };

  const confirmQuit = () => {
    // A renderer choice supersedes an unanswered native confirmation, but never
    // interrupts a shutdown already cancelling active work.
    if (deps.getState().kind === "confirming_active_work" && quitting?.waitingForConfirmation) quitting.active = false;
    return runQuit(stopConfirmedRuntime);
  };

  const requestQuit = async () => {
    if (quitAllowed || quitting?.active) return;
    const state = deps.getState();
    if (state.kind === "confirming_active_work") {
      return runQuit(async () => {
        const confirmed = await deps.askToCancelActiveWork(state.activity);
        if (deps.getState() !== state) return;
        if (quitting) quitting.waitingForConfirmation = false;
        if (confirmed) await stopConfirmedRuntime();
        else await cancelQuit();
      }, true);
    }
    return runQuit(stopRuntimeAndQuit);
  };

  return {
    cancelQuit,
    confirmQuit,
    finishQuit,
    isQuitAllowed: () => quitAllowed,
    isQuitting: () => Boolean(quitting?.active && !quitting.waitingForConfirmation) || quitAllowed,
    requestQuit,
  };
};
