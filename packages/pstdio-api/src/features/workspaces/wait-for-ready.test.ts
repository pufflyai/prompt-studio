import { describe, expect, test } from "bun:test";
import { waitForWorkspaceReady } from "./wait-for-ready";

// A workspaceSessionService stub that yields a successive workspace state per poll,
// holding the last state once exhausted (so the timeout path keeps seeing "initializing").
const deps = (states: Array<{ id: string; initializing?: boolean } | undefined>) => {
  let i = 0;
  return {
    workspaceSessionService: {
      getWorkspaceBySessionId: async () => states[Math.min(i++, states.length - 1)],
    },
  } as never;
};

describe("waitForWorkspaceReady", () => {
  test("returns immediately when the workspace is already ready", async () => {
    const ws = await waitForWorkspaceReady(deps([{ id: "w1", initializing: false }]), "s1", { pollMs: 1 });
    expect(ws?.initializing).toBe(false);
  });

  test("polls until initializing clears, then returns the ready workspace", async () => {
    const ws = await waitForWorkspaceReady(
      deps([
        { id: "w1", initializing: true },
        { id: "w1", initializing: true },
        { id: "w1", initializing: false },
      ]),
      "s1",
      { pollMs: 1 },
    );
    expect(ws?.initializing).toBe(false);
  });

  test("returns a still-initializing workspace after the timeout so the caller refuses launch", async () => {
    const ws = await waitForWorkspaceReady(deps([{ id: "w1", initializing: true }]), "s1", { timeoutMs: 5, pollMs: 1 });
    expect(ws?.initializing).toBe(true);
  });

  test("is a no-op for a session with no workspace", async () => {
    const ws = await waitForWorkspaceReady(deps([undefined]), "s1", { pollMs: 1 });
    expect(ws).toBeUndefined();
  });
});
