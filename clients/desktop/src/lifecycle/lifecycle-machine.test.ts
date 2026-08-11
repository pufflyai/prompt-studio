import { describe, expect, test } from "bun:test";
import { initialDesktopState, transitionDesktopState } from "./lifecycle-machine";

const desktopRuntime = {
  instanceId: "runtime-one",
  origin: "http://127.0.0.1:43127" as const,
  ownerType: "desktop" as const,
};

describe("desktop lifecycle", () => {
  test("moves through discovery, spawn, readiness, and workbench", () => {
    const spawning = transitionDesktopState(initialDesktopState, { type: "runtime_missing" });
    const readiness = transitionDesktopState(spawning, { type: "runtime_spawned" });
    const workbench = transitionDesktopState(readiness, { type: "runtime_ready", runtime: desktopRuntime });

    expect(spawning).toEqual({ kind: "starting", phase: "spawning" });
    expect(readiness).toEqual({ kind: "starting", phase: "readiness" });
    expect(workbench).toEqual({ kind: "workbench", runtime: desktopRuntime });
  });

  test("confirms active work before closing a desktop-owned runtime", () => {
    const workbench = { kind: "workbench" as const, runtime: desktopRuntime };
    const activity = { sessions: [{ id: "s1", label: "Agent session" }], terminals: [], jobs: [] };
    const confirmation = transitionDesktopState(workbench, { type: "quit_requested", activity });

    expect(confirmation).toEqual({ kind: "confirming_active_work", runtime: desktopRuntime, activity });
    expect(transitionDesktopState(confirmation, { type: "quit_cancelled" })).toEqual(workbench);
    expect(transitionDesktopState(confirmation, { type: "quit_confirmed" })).toEqual({ kind: "closing" });
  });

  test("detaches from persistent runtimes and recovers from unexpected exits", () => {
    const persistent = {
      kind: "workbench" as const,
      runtime: { ...desktopRuntime, ownerType: "persistent" as const },
    };

    expect(transitionDesktopState(persistent, { type: "quit_requested", activity: null })).toEqual({
      kind: "detached",
    });

    const recovery = transitionDesktopState(
      { kind: "workbench", runtime: desktopRuntime },
      { type: "runtime_exited", intentional: false },
    );
    expect(recovery).toMatchObject({ kind: "recovery", error: { code: "unexpected_exit" } });
    expect(transitionDesktopState(recovery, { type: "retry" })).toEqual(initialDesktopState);
  });
});
