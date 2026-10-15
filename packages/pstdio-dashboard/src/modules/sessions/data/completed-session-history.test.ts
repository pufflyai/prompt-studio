import { expect, test } from "bun:test";
import type { SessionStreamHandlers } from "@pstdio/sdk/client";
import type { SessionMessage } from "@pstdio/ui/chat-ui";
import { createRendererReadRegistry } from "@pstdio/workbench";
import { createSessionHistoryController, type SessionHistoryState } from "./session-history-controller";

const messages: SessionMessage[] = [{ id: "answer", role: "assistant", parts: [{ type: "text", text: "Ready" }] }];
const completed = { id: "s", status: "completed", updated_at: "first", last_request_started: "run-1" };
const tick = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

test("reopening an unchanged completed conversation reuses its loaded history without another stream", async () => {
  const reads = createRendererReadRegistry();
  let historyReads = 0;
  let streams = 0;
  let state!: SessionHistoryState;
  const transport = {
    getConversation: async () => {
      historyReads++;
      return { messages };
    },
    getQueuedMessages: async () => ({ messages: [] }),
    connectStream: () => {
      streams++;
      return { close() {} };
    },
  };
  const open = () =>
    createSessionHistoryController({
      sessionId: "s",
      ownerKey: "panel",
      reads,
      transport,
      initialSession: completed,
      onChange: (next) => {
        state = next;
      },
    });
  const first = open();
  first.connect();
  await tick();
  expect(state.messages).toEqual(messages);
  first.dispose();
  const second = open();
  second.connect();
  expect(state.messages).toEqual(messages);
  expect(state.loading).toBe(false);
  await tick();
  expect(historyReads).toBe(1);
  expect(streams).toBe(0);
  second.dispose();
  await reads.dispose();
});

test("a new run observed while the conversation is closed invalidates its completed history", async () => {
  const reads = createRendererReadRegistry();
  let historyReads = 0;
  let state!: SessionHistoryState;
  const transport = {
    getConversation: async () => {
      historyReads++;
      return { messages: [{ ...messages[0], id: `answer-${historyReads}` }] };
    },
    getQueuedMessages: async () => ({ messages: [] }),
    connectStream: () => ({ close() {} }),
  };
  const open = (row = completed) =>
    createSessionHistoryController({
      sessionId: "s",
      ownerKey: "panel",
      reads,
      transport,
      initialSession: row,
      onChange: (next) => {
        state = next;
      },
    });
  const first = open();
  first.connect();
  await tick();
  first.dispose();
  const second = open({ ...completed, updated_at: "second", last_request_started: "run-2" });
  second.connect();
  await tick();
  expect(historyReads).toBe(2);
  expect(state.messages[0].id).toBe("answer-2");
  second.dispose();
  await reads.dispose();
});

test("an active conversation loads from its stream without competing history reads", async () => {
  const reads = createRendererReadRegistry();
  let historyReads = 0;
  let handlers!: SessionStreamHandlers;
  let state!: SessionHistoryState;
  const controller = createSessionHistoryController({
    sessionId: "s",
    ownerKey: "panel",
    reads,
    initialSession: { ...completed, status: "in_progress" },
    transport: {
      getConversation: async () => {
        historyReads++;
        return { messages };
      },
      getQueuedMessages: async () => ({ messages: [] }),
      connectStream: (_id, next) => {
        handlers = next;
        return { close() {} };
      },
    },
    onChange: (next) => {
      state = next;
    },
  });
  controller.connect();
  await tick();
  handlers.onPatch!({ op: "replace", path: "/messages", value: messages });
  handlers.onEnd!({ status: "completed" });
  await tick();
  expect(state.messages).toEqual(messages);
  expect(state.streaming).toBe(false);
  expect(historyReads).toBe(0);
  controller.dispose();
  await reads.dispose();
});

test("explicit retry refreshes an unchanged completed conversation", async () => {
  const reads = createRendererReadRegistry();
  let historyReads = 0;
  let state!: SessionHistoryState;
  const controller = createSessionHistoryController({
    sessionId: "s",
    ownerKey: "panel",
    reads,
    initialSession: completed,
    transport: {
      getConversation: async () => {
        historyReads++;
        return { messages: [{ ...messages[0], id: `answer-${historyReads}` }] };
      },
      getQueuedMessages: async () => ({ messages: [] }),
      connectStream: () => ({ close() {} }),
    },
    onChange: (next) => {
      state = next;
    },
  });
  controller.connect();
  await tick();
  controller.reconnect();
  await tick();
  expect(historyReads).toBe(2);
  expect(state.messages[0].id).toBe("answer-2");
  controller.dispose();
  await reads.dispose();
});

test("different API clients never reuse each other's completed history", async () => {
  const reads = createRendererReadRegistry();
  let state!: SessionHistoryState;
  for (const id of ["first-client", "second-client"]) {
    const controller = createSessionHistoryController({
      sessionId: "s",
      ownerKey: "panel",
      reads,
      initialSession: completed,
      transport: {
        getConversation: async () => ({ messages: [{ ...messages[0], id }] }),
        getQueuedMessages: async () => ({ messages: [] }),
        connectStream: () => ({ close() {} }),
      },
      onChange: (next) => {
        state = next;
      },
    });
    controller.connect();
    await tick();
    expect(state.messages[0].id).toBe(id);
    controller.dispose();
  }
  await reads.dispose();
});

test("completion after a lost stream reads final history rather than caching partial messages", async () => {
  const reads = createRendererReadRegistry();
  let handlers!: SessionStreamHandlers;
  let state!: SessionHistoryState;
  const controller = createSessionHistoryController({
    sessionId: "s",
    ownerKey: "panel",
    reads,
    initialSession: { ...completed, status: "in_progress" },
    transport: {
      getConversation: async () => ({ messages }),
      getQueuedMessages: async () => ({ messages: [] }),
      connectStream: (_id, next) => {
        handlers = next;
        return { close() {} };
      },
    },
    onChange: (next) => {
      state = next;
    },
  });
  controller.connect();
  handlers.onPatch!({ op: "replace", path: "/messages", value: [{ ...messages[0], id: "partial" }] });
  handlers.onError!(new TypeError("Failed to fetch"));
  controller.sessionChanged({ ...completed, updated_at: "finished" });
  await tick();
  expect(state.messages).toEqual(messages);
  expect(state.error).toBeUndefined();
  controller.dispose();
  await reads.dispose();
});
