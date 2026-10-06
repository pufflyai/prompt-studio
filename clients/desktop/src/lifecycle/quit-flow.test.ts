import { describe, expect, test } from "bun:test";
import type { ManagedRuntime } from "../runtime/runtime-manager";
import type { DesktopState } from "./lifecycle-machine";
import { createQuitFlow } from "./quit-flow";

type ShutdownResult = Awaited<ReturnType<Parameters<typeof createQuitFlow>[0]["runtimeManager"]["requestShutdown"]>>;

const runtime: ManagedRuntime = {
  external: false,
  descriptor: {
    schemaVersion: 1,
    protocolVersion: 1,
    pid: 1234,
    instanceId: "runtime-one",
    ownerType: "desktop",
    origin: "http://127.0.0.1:43127",
    token: "runtime-secret",
    appVersion: "0.25.2",
    startedAt: "2026-08-06T08:00:00.000Z",
  },
};

const noActivity = { sessions: [], terminals: [], jobs: [] };

const createHarness = (input: {
  refreshRuntime: () => Promise<ManagedRuntime | null>;
  requestShutdown?: (force: boolean) => Promise<ShutdownResult>;
  cancelActiveWork?: boolean;
}) => {
  let state: DesktopState = { kind: "workbench", runtime: runtime.descriptor };
  const calls: string[] = [];
  const flow = createQuitFlow({
    runtimeManager: {
      refreshRuntime: input.refreshRuntime,
      requestShutdown: input.requestShutdown ?? (async () => ({ state: "accepted" })),
      waitForExit: async () => {
        calls.push("waitForExit");
      },
      detach: () => {
        calls.push("detach");
      },
    },
    getState: () => state,
    setState: (next) => {
      state = next;
    },
    showLifecycle: async () => {},
    showQuitConfirmation: async () => {
      calls.push("showQuitConfirmation");
    },
    askToCancelActiveWork: async () => {
      calls.push("askToCancelActiveWork");
      return input.cancelActiveWork ?? false;
    },
    flushBeforeQuit: async () => {},
    quitApp: () => {
      calls.push("quitApp");
    },
    recoveryError: (error) => ({ code: "unexpected_exit", message: String(error), actions: ["quit"] }),
    logError: () => {},
  });
  const setState = (next: DesktopState) => {
    state = next;
  };
  return { calls, flow, setState, state: () => state };
};

describe("desktop quit flow", () => {
  test("quits when the runtime already stopped", async () => {
    const { calls, flow } = createHarness({ refreshRuntime: async () => null });

    await flow.requestQuit();

    expect(calls).toEqual(["detach", "quitApp"]);
    expect(flow.isQuitAllowed()).toBe(true);
  });

  test("shows the failure and lets the next quit try again", async () => {
    let refreshes = 0;
    const { calls, flow, state } = createHarness({
      refreshRuntime: async () => {
        refreshes += 1;
        if (refreshes === 1) throw new Error("runtime discovery failed");
        return null;
      },
    });

    await flow.requestQuit();

    expect(state()).toMatchObject({ kind: "recovery" });
    expect(flow.isQuitAllowed()).toBe(false);

    await flow.requestQuit();

    expect(calls).toEqual(["detach", "quitApp"]);
  });

  test("asks again with a dialog when quit is pressed while active work waits for confirmation", async () => {
    const requests: boolean[] = [];
    const { calls, flow, state } = createHarness({
      cancelActiveWork: true,
      refreshRuntime: async () => runtime,
      requestShutdown: async (force) => {
        requests.push(force);
        return force
          ? { state: "accepted" }
          : { state: "active", activity: { ...noActivity, sessions: [{ id: "s1", label: "Session" }] } };
      },
    });

    await flow.requestQuit();

    expect(state()).toMatchObject({ kind: "confirming_active_work" });

    await flow.requestQuit();

    expect(requests).toEqual([false, true]);
    expect(calls).toEqual(["showQuitConfirmation", "askToCancelActiveWork", "waitForExit", "quitApp"]);
  });

  test("quits after the runtime crashes during an active-work confirmation", async () => {
    let current: ManagedRuntime | null = runtime;
    const { calls, flow, setState } = createHarness({
      refreshRuntime: async () => current,
      requestShutdown: async () => ({
        state: "active",
        activity: { ...noActivity, jobs: [{ id: "j1", label: "Job" }] },
      }),
    });

    await flow.requestQuit();
    // The runtime manager forgets the crashed runtime, and main shows recovery instead.
    current = null;
    setState({ kind: "recovery", error: { code: "unexpected_exit", message: "crashed", actions: ["quit"] } });

    await flow.requestQuit();

    expect(calls).toEqual(["showQuitConfirmation", "detach", "quitApp"]);
  });
});
