import { describe, expect, mock, test } from "bun:test";
import type { HarnessSession } from "pstdio-api-contracts";
import { createSessionStore } from "./session-store";

describe("session-store", () => {
  test("creates and retrieves an active session", () => {
    const store = createSessionStore();
    const entry = store.create("s1", mock());
    expect(entry.eventStore).toBeDefined();
    expect(entry.approvalService).toBeDefined();
    expect(entry.session).toBeNull();
    expect(store.get("s1")).toBe(entry);
  });

  test("returns null for unknown session", () => {
    const store = createSessionStore();
    expect(store.get("unknown")).toBeNull();
  });

  test("setSession attaches the harness session to the entry", () => {
    const store = createSessionStore();
    store.create("s1", mock());
    const harnessSession: HarnessSession = {
      agentSessionId: "agent_1",
      done: Promise.resolve({ status: "completed" }),
      stop: mock(),
    };
    store.setSession("s1", harnessSession);
    expect(store.get("s1")!.session).toBe(harnessSession);
  });

  test("setSession refuses publication when cancellation won the install race", () => {
    const store = createSessionStore();
    store.create("s1", mock());
    store.markCancellationRequested("s1");
    const harnessSession: HarnessSession = {
      agentSessionId: "agent_1",
      done: new Promise(() => {}),
      stop: mock(),
    };

    expect(store.setSession("s1", harnessSession)).toBe(false);
    expect(store.get("s1")?.session).toBe(harnessSession);
  });

  test("remove cleans up session", () => {
    const store = createSessionStore();
    store.create("s1", mock());
    store.remove("s1");
    expect(store.get("s1")).toBeNull();
  });

  test("creating same session ID replaces the previous one", () => {
    const store = createSessionStore();
    const first = store.create("s1", mock());
    const second = store.create("s1", mock());
    expect(store.get("s1")).toBe(second);
    expect(store.get("s1")).not.toBe(first);
  });
});
