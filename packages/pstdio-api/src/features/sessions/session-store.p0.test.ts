import { describe, expect, mock, test } from "bun:test";
import type { HarnessSession, SessionMessage } from "pstdio-api-contracts";
import { createSessionStore } from "./session-store";
import { inertSessionChannelHooks } from "./session-store.test-utils";

describe("session-store", () => {
  test("creates and retrieves an active session", () => {
    const store = createSessionStore();
    const entry = store.create("s1", inertSessionChannelHooks);
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
    store.create("s1", inertSessionChannelHooks);
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
    store.create("s1", inertSessionChannelHooks);
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
    store.create("s1", inertSessionChannelHooks);
    store.remove("s1");
    expect(store.get("s1")).toBeNull();
  });

  test("creating same session ID replaces the previous one", () => {
    const store = createSessionStore();
    const first = store.create("s1", inertSessionChannelHooks);
    const second = store.create("s1", inertSessionChannelHooks);
    expect(store.get("s1")).toBe(second);
    expect(store.get("s1")).not.toBe(first);
  });
});

test("diagnostics read live session and conversation owner sizes without exposing messages", async () => {
  const store = createSessionStore();
  const entry = store.create("diagnostics", inertSessionChannelHooks);
  const conversation = await entry.conversationReady;
  conversation.push({ op: "add", path: "/messages/0", value: { id: "private", role: "assistant", parts: [] } });
  const reading = await store.diagnostics();
  expect(reading).toMatchObject({ activeSessions: 1, retainedMessages: 1, subscribers: 0, queuedEvents: 0 });
  expect(JSON.stringify(reading)).not.toContain("private");
  store.remove("diagnostics");
  expect(await store.diagnostics()).toMatchObject({ activeSessions: 0, retainedMessages: 0 });
});

test("diagnostics remain available while a session initializes", async () => {
  const store = createSessionStore();
  const pending = Promise.withResolvers<SessionMessage[]>();
  const entry = store.create("loading", inertSessionChannelHooks, () => pending.promise);
  const reading = await Promise.race([store.diagnostics(), Promise.resolve("waiting for initialization")]);
  expect(reading).toMatchObject({ activeSessions: 1, retainedMessages: 0 });
  pending.resolve([]);
  await entry.conversationReady;
  store.remove("loading");
});
