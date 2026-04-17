import { describe, expect, it } from "bun:test";
import { createEventStore } from "../../services/event-store";
import type { JsonPatch } from "../../types";
import { pollOpencodeMessages } from "./opencode-session-poller";
import type { OpencodeSessionMessage } from "./opencode-types";

// --- Helpers ---

const userMessage = (text: string): OpencodeSessionMessage => ({
  role: "user",
  content: [{ type: "text", text }],
});

const assistantMessage = (
  parts: { type: string; tool?: string; text?: string; state?: { status?: string; input?: unknown } }[],
  time?: { created?: number; completed?: number },
): OpencodeSessionMessage => ({
  info: { role: "assistant", time: { created: time?.created ?? Date.now(), ...time } },
  parts,
});

const completedAssistant = (text: string): OpencodeSessionMessage =>
  assistantMessage([{ type: "text", text }], { created: Date.now(), completed: Date.now() });

const inFlightAssistant = (text: string): OpencodeSessionMessage =>
  assistantMessage([{ type: "text", text }], { created: Date.now() });

const questionAssistant = (): OpencodeSessionMessage =>
  assistantMessage(
    [
      { type: "text", text: "Let me ask you something." },
      {
        type: "tool",
        tool: "question",
        state: {
          status: "completed",
          input: { questions: [{ id: "q1", question: "Which?", options: ["A", "B"] }] },
        },
      },
    ],
    { created: Date.now() },
  );

/** Creates a mock message loader that returns messages from a mutable array. */
const createMessageTimeline = () => {
  let messages: OpencodeSessionMessage[] = [];
  const loader = async () => [...messages];
  const set = (next: OpencodeSessionMessage[]) => {
    messages = next;
  };
  return { loader, set };
};

const collectPatches = (eventStore: ReturnType<typeof createEventStore>) => {
  const patches: JsonPatch[] = [];
  const sub = eventStore.subscribe();
  const reader = (async () => {
    for await (const patch of sub) {
      patches.push(patch);
    }
  })();
  return { patches, done: reader };
};

// --- Tests ---

describe("pollOpencodeMessages", () => {
  it("completes when the assistant turn finishes with a completed timestamp", async () => {
    const { loader, set } = createMessageTimeline();
    const eventStore = createEventStore();

    // Simulate: initial user message exists, assistant responds and completes
    set([userMessage("hello")]);

    let resolvePost: () => void;
    const messageComplete = new Promise<void>((r) => {
      resolvePost = r;
    });

    const poll = pollOpencodeMessages({
      loadMessages: loader,
      sessionId: "s1",
      cwd: undefined,
      eventStore,
      baselineCount: 1,
      messageComplete,
    });

    // First poll: no new messages yet
    await tick();

    // Agent responds with in-flight message
    set([userMessage("hello"), inFlightAssistant("thinking...")]);
    await tick();

    // Agent finishes
    set([userMessage("hello"), completedAssistant("done!")]);
    resolvePost!();
    await tick();

    const result = await poll;
    expect(result.code).toBe(0);

    const history = eventStore.getHistory();
    const statusPatch = history.find((p) => p.path === "/status");
    expect(statusPatch?.value).toBe("completed");
    eventStore.close();
  });

  it("completes when the assistant asks a question (no completed timestamp)", async () => {
    const { loader, set } = createMessageTimeline();
    const eventStore = createEventStore();

    set([userMessage("implement feature X")]);

    let resolvePost: () => void;
    const messageComplete = new Promise<void>((r) => {
      resolvePost = r;
    });

    const poll = pollOpencodeMessages({
      loadMessages: loader,
      sessionId: "s1",
      cwd: undefined,
      eventStore,
      baselineCount: 1,
      messageComplete,
    });

    await tick();

    // Agent asks a question — no completed timestamp
    set([userMessage("implement feature X"), questionAssistant()]);
    resolvePost!();
    await tick();

    const result = await poll;
    expect(result.code).toBe(0);

    const history = eventStore.getHistory();
    const statusPatch = history.find((p) => p.path === "/status");
    expect(statusPatch?.value).toBe("completed");
    eventStore.close();
  });

  it("does NOT stop when only the user answer message is visible (waits for assistant response)", async () => {
    const { loader, set } = createMessageTimeline();
    const eventStore = createEventStore();
    const { patches } = collectPatches(eventStore);

    // Baseline: user message + assistant question (from previous turn)
    const baseline: OpencodeSessionMessage[] = [userMessage("implement feature X"), questionAssistant()];
    set(baseline);

    let resolvePost: () => void;
    const messageComplete = new Promise<void>((r) => {
      resolvePost = r;
    });

    const poll = pollOpencodeMessages({
      loadMessages: loader,
      sessionId: "s1",
      cwd: undefined,
      eventStore,
      baselineCount: 2, // baseline includes user + assistant question
      messageComplete,
    });

    await tick();

    // User's answer appears — but no assistant response yet
    set([...baseline, userMessage("TypeScript")]);
    await tick();
    await tick();

    // The poller should still be running — verify no "completed" status yet
    const statusPatches = patches.filter((p) => p.path === "/status");
    expect(statusPatches).toHaveLength(0);

    // Now the assistant responds
    set([...baseline, userMessage("TypeScript"), completedAssistant("Great, using TypeScript!")]);
    resolvePost!();
    await tick();

    const result = await poll;
    expect(result.code).toBe(0);

    const history = eventStore.getHistory();
    const finalStatus = history.filter((p: JsonPatch) => p.path === "/status").at(-1);
    expect(finalStatus?.value).toBe("completed");
    eventStore.close();
  });

  it("stops when POST fails and no new messages appeared", async () => {
    const { loader, set } = createMessageTimeline();
    const eventStore = createEventStore();

    set([userMessage("hello")]);

    const messageComplete = Promise.reject(new Error("network error"));
    messageComplete.catch(() => {}); // prevent unhandled rejection

    const poll = pollOpencodeMessages({
      loadMessages: loader,
      sessionId: "s1",
      cwd: undefined,
      eventStore,
      baselineCount: 1,
      messageComplete,
    });

    await tick();

    const result = await poll;
    expect(result.code).toBe(1);

    const history = eventStore.getHistory();
    expect(history.filter((p: JsonPatch) => p.path === "/status").at(-1)?.value).toBe("failed");
    eventStore.close();
  });

  it("stops when POST succeeds with no visible activity and nothing in flight", async () => {
    const { loader, set } = createMessageTimeline();
    const eventStore = createEventStore();

    set([userMessage("hello")]);

    const messageComplete = Promise.resolve();

    const poll = pollOpencodeMessages({
      loadMessages: loader,
      sessionId: "s1",
      cwd: undefined,
      eventStore,
      baselineCount: 1,
      messageComplete,
    });

    await tick();
    await tick();

    const result = await poll;
    expect(result.code).toBe(0);
    eventStore.close();
  });
});

describe("pollOpencodeMessages multi-turn conversation", () => {
  it("handles question→answer→question→answer→final response across 3 turns", async () => {
    const { loader, set } = createMessageTimeline();

    // --- Turn 1: User asks, agent asks a question ---
    const es1 = createEventStore();
    set([userMessage("build a CLI tool")]);

    let resolvePost1: () => void;
    const mc1 = new Promise<void>((r) => {
      resolvePost1 = r;
    });

    const poll1 = pollOpencodeMessages({
      loadMessages: loader,
      sessionId: "s1",
      cwd: undefined,
      eventStore: es1,
      baselineCount: 1,
      messageComplete: mc1,
    });

    await tick();
    set([userMessage("build a CLI tool"), questionAssistant()]);
    resolvePost1!();
    await tick();

    expect((await poll1).code).toBe(0);
    expect(
      es1
        .getHistory()
        .filter((p: JsonPatch) => p.path === "/status")
        .at(-1)?.value,
    ).toBe("completed");

    // --- Turn 2: User answers, agent asks another question ---
    const es2 = createEventStore();
    const baseline2: OpencodeSessionMessage[] = [userMessage("build a CLI tool"), questionAssistant()];
    set(baseline2);

    let resolvePost2: () => void;
    const mc2 = new Promise<void>((r) => {
      resolvePost2 = r;
    });

    const poll2 = pollOpencodeMessages({
      loadMessages: loader,
      sessionId: "s1",
      cwd: undefined,
      eventStore: es2,
      baselineCount: 2,
      messageComplete: mc2,
    });

    await tick();
    // User answer appears — poller must NOT stop here
    set([...baseline2, userMessage("TypeScript")]);
    await tick();
    await tick();
    expect(es2.getHistory().filter((p) => p.path === "/status")).toHaveLength(0);

    // Agent asks another question
    set([...baseline2, userMessage("TypeScript"), questionAssistant()]);
    resolvePost2!();
    await tick();

    expect((await poll2).code).toBe(0);
    expect(
      es2
        .getHistory()
        .filter((p: JsonPatch) => p.path === "/status")
        .at(-1)?.value,
    ).toBe("completed");

    // --- Turn 3: User answers, agent completes normally ---
    const es3 = createEventStore();
    const baseline3 = [...baseline2, userMessage("TypeScript"), questionAssistant()];
    set(baseline3);

    let resolvePost3: () => void;
    const mc3 = new Promise<void>((r) => {
      resolvePost3 = r;
    });

    const poll3 = pollOpencodeMessages({
      loadMessages: loader,
      sessionId: "s1",
      cwd: undefined,
      eventStore: es3,
      baselineCount: 4,
      messageComplete: mc3,
    });

    await tick();
    set([...baseline3, userMessage("yes, add tests")]);
    await tick();
    await tick();
    expect(es3.getHistory().filter((p) => p.path === "/status")).toHaveLength(0);

    set([...baseline3, userMessage("yes, add tests"), completedAssistant("Done!")]);
    resolvePost3!();
    await tick();

    expect((await poll3).code).toBe(0);
    expect(
      es3
        .getHistory()
        .filter((p: JsonPatch) => p.path === "/status")
        .at(-1)?.value,
    ).toBe("completed");

    es1.close();
    es2.close();
    es3.close();
  }, 30_000);
});

// Wait for the 1-second poll interval + microtasks to settle
const tick = () => new Promise((resolve) => setTimeout(resolve, 1_100));
