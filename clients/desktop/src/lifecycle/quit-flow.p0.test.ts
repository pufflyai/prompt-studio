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
  showQuitConfirmation?: () => Promise<void>;
  askToCancelActiveWork?: () => Promise<boolean>;
  showLifecycle?: () => Promise<void>;
  flushBeforeQuit?: () => Promise<void>;
}) => {
  let state: DesktopState = { kind: "workbench", runtime: runtime.descriptor };
  const calls: string[] = [];
  const flow = createQuitFlow({
    runtimeManager: {
      cancelStart: async () => {},
      refreshRuntime: input.refreshRuntime,
      requestShutdown: input.requestShutdown ?? (async () => ({ state: "accepted" })),
      waitForExit: async () => {
        calls.push("waitForExit");
      },
      detach: async () => {
        calls.push("detach");
      },
    },
    getState: () => state,
    setState: (next) => {
      state = next;
    },
    showLifecycle: async () => input.showLifecycle?.(),
    showQuitConfirmation: async () => {
      calls.push("showQuitConfirmation");
      await input.showQuitConfirmation?.();
    },
    askToCancelActiveWork: async () => {
      calls.push("askToCancelActiveWork");
      return input.askToCancelActiveWork?.() ?? input.cancelActiveWork ?? false;
    },
    flushBeforeQuit: input.flushBeforeQuit ?? (async () => {}),
    quitApp: (intent) => {
      calls.push(intent === "install-update" ? "install-update" : "quitApp");
    },
    recoveryError: (error) => ({ code: "unexpected_exit", message: String(error), actions: ["quit"] }),
    logError: () => {},
  });
  const setState = (next: DesktopState) => {
    state = next;
  };
  return { calls, flow, setState, state: () => state };
};

describe("desktop quit flow with a broken interface", () => {
  test.each([
    false,
    true,
  ])("a broken closing interface does not stop owned shutdown (confirmed: %s)", async (confirmed) => {
    const requests: boolean[] = [];
    const { flow, calls } = createHarness({
      refreshRuntime: async () => runtime,
      showLifecycle: async () => {
        throw new Error("Preload failed");
      },
      requestShutdown: async (force) => {
        requests.push(force);
        return confirmed && !force
          ? { state: "active", activity: { ...noActivity, sessions: [{ id: "s1", label: "Session" }] } }
          : { state: "accepted" };
      },
    });
    await flow.requestQuit();
    if (confirmed) await flow.confirmQuit();
    expect(requests).toEqual(confirmed ? [false, true] : [false]);
    expect(calls).toContain("waitForExit");
    expect(calls).toContain("quitApp");
    expect(flow.isQuitAllowed()).toBe(true);
  });

  test.each([
    false,
    true,
  ])("native confirmation preserves the active-work choice when preload fails (quit: %s)", async (quit) => {
    const requests: boolean[] = [];
    const { flow, calls, state } = createHarness({
      refreshRuntime: async () => runtime,
      showLifecycle: async () => {
        throw new Error("Preload failed");
      },
      showQuitConfirmation: async () => {
        throw new Error("Preload failed");
      },
      cancelActiveWork: quit,
      requestShutdown: async (force) => {
        requests.push(force);
        return force
          ? { state: "accepted" }
          : { state: "active", activity: { ...noActivity, sessions: [{ id: "s1", label: "Session" }] } };
      },
    });
    await flow.requestQuit();
    expect(requests).toEqual(quit ? [false, true] : [false]);
    expect(calls).toContain("askToCancelActiveWork");
    expect(calls.includes("quitApp")).toBe(quit);
    expect(state().kind).toBe(quit ? "closing" : "workbench");
  });

  test("a broken recovery interface leaves a failed quit available to retry", async () => {
    let refreshes = 0;
    const { flow, calls } = createHarness({
      refreshRuntime: async () => {
        if (++refreshes === 1) throw new Error("Runtime discovery failed");
        return null;
      },
      showLifecycle: async () => {
        throw new Error("Preload failed");
      },
    });
    await flow.requestQuit();
    expect(flow.isQuitting()).toBe(false);
    await flow.requestQuit();
    expect(calls).toContain("quitApp");
  });
});

describe("desktop quit flow", () => {
  test.each([
    "keep open",
    "quit",
    "failure",
  ])("preserves crash recovery when the pending native dialog returns %s", async (answer) => {
    const opened = Promise.withResolvers<void>();
    const native = Promise.withResolvers<boolean>();
    const requests: boolean[] = [];
    const { flow, state, setState } = createHarness({
      refreshRuntime: async () => runtime,
      askToCancelActiveWork: async () => {
        opened.resolve();
        return native.promise;
      },
      requestShutdown: async (force) => {
        requests.push(force);
        return { state: "active", activity: { ...noActivity, sessions: [{ id: "s1", label: "Session" }] } };
      },
    });
    await flow.requestQuit();
    const repeated = flow.requestQuit();
    await opened.promise;
    const recovery: DesktopState = {
      kind: "recovery",
      error: { code: "unexpected_exit", message: "Backend crashed", actions: ["quit"] },
    };
    try {
      // Main uses this guard to admit unexpected-exit recovery.
      expect(flow.isQuitting()).toBe(false);
      setState(recovery);
      if (answer === "failure") native.reject(new Error("Native dialog closed"));
      else native.resolve(answer === "quit");
      await repeated;
      expect(state()).toBe(recovery);
      expect(requests).toEqual([false]);
    } finally {
      native.resolve(false);
      await repeated;
    }
  });

  test.each([
    "keep open",
    "quit",
    "failure",
  ])("keeps the window's confirmed quit when the native dialog later returns %s", async (answer) => {
    const opened = Promise.withResolvers<void>();
    const native = Promise.withResolvers<boolean>();
    const cancelling = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const requests: boolean[] = [];
    const { flow, calls, state } = createHarness({
      refreshRuntime: async () => runtime,
      askToCancelActiveWork: async () => {
        opened.resolve();
        return native.promise;
      },
      requestShutdown: async (force) => {
        requests.push(force);
        if (!force) return { state: "active", activity: { ...noActivity, sessions: [{ id: "s1", label: "Session" }] } };
        cancelling.resolve();
        await release.promise;
        return { state: "accepted" };
      },
    });
    await flow.requestQuit();
    const repeated = flow.requestQuit();
    await opened.promise;
    const confirmed = flow.confirmQuit();
    try {
      expect(await Promise.race([cancelling.promise.then(() => true), confirmed.then(() => false)])).toBe(true);
      if (answer === "failure") native.reject(new Error("Native dialog closed"));
      else native.resolve(answer === "quit");
      await repeated;
      expect(state()).toMatchObject({ kind: "closing" });
      expect(flow.isQuitting()).toBe(true);
      expect(requests).toEqual([false, true]);
    } finally {
      native.resolve(false);
      release.resolve();
      await Promise.all([confirmed, repeated]);
    }
    expect(calls.filter((call) => call === "quitApp")).toHaveLength(1);
  });

  test.each([
    "opens",
    "fails",
  ])("keeps confirmed shutdown when the confirmation window %s afterward", async (window) => {
    const showing = Promise.withResolvers<void>();
    const releaseWindow = Promise.withResolvers<void>();
    const cancelling = Promise.withResolvers<void>();
    const releaseCancellation = Promise.withResolvers<void>();
    const requests: boolean[] = [];
    const { flow, calls, state } = createHarness({
      refreshRuntime: async () => runtime,
      showQuitConfirmation: async () => {
        showing.resolve();
        await releaseWindow.promise;
      },
      requestShutdown: async (force) => {
        requests.push(force);
        if (!force) return { state: "active", activity: { ...noActivity, sessions: [{ id: "s1", label: "Session" }] } };
        cancelling.resolve();
        await releaseCancellation.promise;
        return { state: "accepted" };
      },
    });
    const initial = flow.requestQuit();
    await showing.promise;
    const confirmed = flow.confirmQuit();
    try {
      expect(await Promise.race([cancelling.promise.then(() => true), confirmed.then(() => false)])).toBe(true);
      if (window === "fails") releaseWindow.reject(new Error("Confirmation window retired"));
      else releaseWindow.resolve();
      await initial;
      expect(flow.isQuitting()).toBe(true);
      expect(state()).toMatchObject({ kind: "closing" });
      await flow.requestQuit();
      expect(requests).toEqual([false, true]);
    } finally {
      releaseWindow.resolve();
      releaseCancellation.resolve();
      await Promise.all([initial, confirmed]);
    }
    expect(calls.filter((call) => call === "quitApp")).toHaveLength(1);
  });

  test("keeps confirmed shutdown single-flight while active work is cancelling", async () => {
    const cancelling = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const requests: boolean[] = [];
    const { flow, state, calls } = createHarness({
      refreshRuntime: async () => runtime,
      requestShutdown: async (force) => {
        requests.push(force);
        if (force) {
          cancelling.resolve();
          await release.promise;
          return { state: "accepted" };
        }
        return requests.length === 1
          ? { state: "active", activity: { ...noActivity, sessions: [{ id: "s1", label: "Session" }] } }
          : { state: "failed" };
      },
    });
    await flow.requestQuit();
    const confirmed = flow.confirmQuit();
    await cancelling.promise;
    try {
      await flow.requestQuit();
      expect(flow.isQuitting()).toBe(true);
      expect(requests).toEqual([false, true]);
      expect(state()).toMatchObject({ kind: "closing" });
    } finally {
      release.resolve();
      await confirmed;
    }
    expect(calls.filter((call) => call === "quitApp")).toHaveLength(1);
  });

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

test("installing an upgrade waits for shutdown and clearing active work", async () => {
  const { flow, calls } = createHarness({
    refreshRuntime: async () => runtime,
    requestShutdown: async (force) =>
      force
        ? { state: "accepted" }
        : { state: "active", activity: { ...noActivity, sessions: [{ id: "s1", label: "Session" }] } },
  });
  await flow.requestUpgrade();
  expect(calls).toEqual(["showQuitConfirmation"]);
  await flow.cancelQuit();
  await flow.requestUpgrade();
  await flow.confirmQuit();
  expect(calls).toEqual(["showQuitConfirmation", "showQuitConfirmation", "waitForExit", "install-update"]);
});

test("an ordinary quit after dismissing an upgrade never requests a relaunch", async () => {
  let busy = true;
  const { flow, calls } = createHarness({
    refreshRuntime: async () => runtime,
    requestShutdown: async () =>
      busy
        ? { state: "active", activity: { ...noActivity, sessions: [{ id: "s1", label: "Session" }] } }
        : { state: "accepted" },
  });
  await flow.requestUpgrade();
  await flow.cancelQuit();
  busy = false;
  await flow.requestQuit();
  expect(calls).toEqual(["showQuitConfirmation", "waitForExit", "quitApp"]);
});

test("an upgrade and a concurrent runtime exit hand off to the installer once", async () => {
  const flushing = Promise.withResolvers<void>();
  const flushed = Promise.withResolvers<void>();
  const { flow, calls } = createHarness({
    refreshRuntime: async () => runtime,
    flushBeforeQuit: async () => {
      flushing.resolve();
      await flushed.promise;
    },
  });
  const upgrade = flow.requestUpgrade();
  await flushing.promise;
  const runtimeExit = flow.finishQuit();
  flushed.resolve();
  await Promise.all([upgrade, runtimeExit]);
  expect(calls).toEqual(["waitForExit", "install-update"]);
});
