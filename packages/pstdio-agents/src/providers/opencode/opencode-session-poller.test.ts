import { describe, expect, test } from "bun:test";
import type { EventStore, JsonPatch } from "../../types";
import { pollOpencodeMessages, pollOpencodeUntilIdle } from "./opencode-session-poller";
import type { OpencodeSessionMessage } from "./opencode-types";

const createEventStore = (): EventStore & { patches: JsonPatch[] } => {
  const patches: JsonPatch[] = [];
  const subscribers: ((patch: JsonPatch) => void)[] = [];

  return {
    patches,
    push(patch: JsonPatch) {
      patches.push(patch);
      for (const sub of subscribers) sub(patch);
    },
    getHistory: () => patches,
    subscribe: () => ({
      [Symbol.asyncIterator]: () => ({ next: () => new Promise<IteratorResult<JsonPatch>>(() => {}) }),
    }),
    historyPlusStream: () => ({
      [Symbol.asyncIterator]: () => ({ next: () => new Promise<IteratorResult<JsonPatch>>(() => {}) }),
    }),
    snapshotAndSubscribe: () => ({
      history: patches,
      stream: {
        [Symbol.asyncIterator]: () => ({ next: () => new Promise<IteratorResult<JsonPatch>>(() => {}) }),
      },
    }),
  };
};

const userMessage: OpencodeSessionMessage = { role: "user", content: [{ type: "text", text: "hello" }] };

const completedAssistantMessage = (
  parts: OpencodeSessionMessage extends infer T ? (T extends { parts?: infer P } ? P : never) : never,
  error?: { name?: string; data?: { message?: string } },
): OpencodeSessionMessage => ({
  info: {
    id: `msg-${Math.random()}`,
    role: "assistant",
    time: { created: Date.now(), completed: Date.now() },
    error,
  },
  parts: parts ?? [],
});

const errorInfo = {
  name: "service_unavailable_error",
  data: { message: "Our servers are currently overloaded." },
};

const lastStatusPatch = (store: { patches: JsonPatch[] }) =>
  [...store.patches].reverse().find((p) => p.path === "/status");

describe("pollOpencodeMessages", () => {
  test("marks session as failed when current turn has an error", async () => {
    const errorMessage = completedAssistantMessage([{ type: "text", text: "partial" }], errorInfo);
    const eventStore = createEventStore();

    const result = await pollOpencodeMessages({
      loadMessages: async () => [userMessage, errorMessage],
      sessionId: "test-session",
      cwd: "/tmp",
      eventStore,
      baselineCount: 1,
      messageComplete: Promise.resolve(),
    });

    expect(lastStatusPatch(eventStore)?.value).toBe("failed");
    expect(result.code).toBe(1);
  });

  test("marks session as completed when current turn has no errors", async () => {
    const assistantMessage = completedAssistantMessage([{ type: "text", text: "hi there" }]);
    const eventStore = createEventStore();

    const result = await pollOpencodeMessages({
      loadMessages: async () => [userMessage, assistantMessage],
      sessionId: "test-session",
      cwd: "/tmp",
      eventStore,
      baselineCount: 1,
      messageComplete: Promise.resolve(),
    });

    expect(lastStatusPatch(eventStore)?.value).toBe("completed");
    expect(result.code).toBe(0);
  });

  test("historical error does not poison a successful follow-up turn", async () => {
    const oldError = completedAssistantMessage([{ type: "text", text: "old fail" }], errorInfo);
    const followUpUser: OpencodeSessionMessage = { role: "user", content: [{ type: "text", text: "retry" }] };
    const successReply = completedAssistantMessage([{ type: "text", text: "success" }]);
    const eventStore = createEventStore();

    const result = await pollOpencodeMessages({
      loadMessages: async () => [userMessage, oldError, followUpUser, successReply],
      sessionId: "test-session",
      cwd: "/tmp",
      eventStore,
      baselineCount: 3,
      messageComplete: Promise.resolve(),
    });

    expect(lastStatusPatch(eventStore)?.value).toBe("completed");
    expect(result.code).toBe(0);
  });
});

describe("pollOpencodeUntilIdle", () => {
  test("marks session as failed when trailing message has an error", async () => {
    const errorMessage = completedAssistantMessage([{ type: "text", text: "partial" }], errorInfo);
    const eventStore = createEventStore();

    const result = await pollOpencodeUntilIdle({
      loadMessages: async () => [userMessage, errorMessage],
      sessionId: "test-session",
      cwd: "/tmp",
      eventStore,
    });

    expect(lastStatusPatch(eventStore)?.value).toBe("failed");
    expect(result.code).toBe(1);
  });

  test("historical error does not poison reattach when trailing turn succeeds", async () => {
    const oldError = completedAssistantMessage([{ type: "text", text: "old fail" }], errorInfo);
    const followUpUser: OpencodeSessionMessage = { role: "user", content: [{ type: "text", text: "retry" }] };
    const successReply = completedAssistantMessage([{ type: "text", text: "all good" }]);
    const eventStore = createEventStore();

    const result = await pollOpencodeUntilIdle({
      loadMessages: async () => [userMessage, oldError, followUpUser, successReply],
      sessionId: "test-session",
      cwd: "/tmp",
      eventStore,
    });

    expect(lastStatusPatch(eventStore)?.value).toBe("completed");
    expect(result.code).toBe(0);
  });
});
