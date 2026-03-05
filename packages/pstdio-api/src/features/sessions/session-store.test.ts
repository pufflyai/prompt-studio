import { describe, expect, mock, test } from "bun:test";
import { createSessionStore } from "./session-store";

describe("session-store", () => {
  test("creates and retrieves an active session", () => {
    const store = createSessionStore();
    const entry = store.create("s1", mock());
    expect(entry.eventStore).toBeDefined();
    expect(entry.approvalService).toBeDefined();
    expect(entry.process).toBeNull();
    expect(store.get("s1")).toBe(entry);
  });

  test("returns null for unknown session", () => {
    const store = createSessionStore();
    expect(store.get("unknown")).toBeNull();
  });

  test("setProcess attaches process to session", () => {
    const store = createSessionStore();
    store.create("s1", mock());
    const fakeProcess = {
      sessionId: "s1",
      stdin: {} as any,
      kill: mock(),
      onExit: Promise.resolve({ code: 0, signal: null }),
    };
    store.setProcess("s1", fakeProcess);
    expect(store.get("s1")!.process).toBe(fakeProcess);
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
