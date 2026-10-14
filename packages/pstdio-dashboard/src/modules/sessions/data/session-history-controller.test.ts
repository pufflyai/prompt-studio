import { expect, test } from "bun:test";
import type { SessionStreamHandlers } from "@pstdio/sdk/client";
import type { SessionMessage } from "@pstdio/ui/chat-ui";
import { createRendererReadRegistry } from "@pstdio/workbench";
import { createSessionHistoryController, type SessionHistoryState } from "./session-history-controller";

const message = (id: string): SessionMessage => ({ id, role: "user", parts: [{ type: "text", text: id }] });
const tick = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

test("SSE owns even an empty transcript and the queue while it is live", async () => {
  const registry = createRendererReadRegistry();
  let handlers!: SessionStreamHandlers;
  let historyReads = 0;
  let queueReads = 0;
  let state!: SessionHistoryState;
  const controller = createSessionHistoryController({
    sessionId: "s",
    ownerKey: "placement",
    reads: registry,
    initialSession: { id: "s", status: "in_progress" },
    transport: {
      getConversation: async () => {
        historyReads++;
        return { messages: [] };
      },
      getQueuedMessages: async () => {
        queueReads++;
        return { messages: [message("queued-prompt-s-1")] };
      },
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
  handlers.onPatch!({ op: "replace", path: "/messages", value: [] });
  for (let i = 0; i < 1000; i++) controller.sessionChanged({ id: "s", status: "in_progress" });
  controller.sessionChanged({ id: "other", status: "in_progress" });
  await tick();
  expect(historyReads).toBe(0);
  expect(queueReads).toBe(1);
  expect(state.messages).toEqual([message("queued-prompt-s-1")]);
  // After the stream ends, session row events are the only queue signal left.
  handlers.onEnd!({});
  await tick();
  controller.sessionChanged({ id: "s", status: "completed" });
  await tick();
  expect(historyReads).toBe(0);
  expect(queueReads).toBe(3);
  controller.dispose();
  await registry.dispose();
});

test("a new run cancels obsolete history loading and rejects stale stream events", async () => {
  const registry = createRendererReadRegistry();
  const requests: ReturnType<typeof Promise.withResolvers<{ messages: SessionMessage[] }>>[] = [];
  const streams: SessionStreamHandlers[] = [];
  let state!: SessionHistoryState;
  let signal!: AbortSignal;
  const controller = createSessionHistoryController({
    sessionId: "s",
    ownerKey: "placement",
    reads: registry,
    initialSession: { id: "s", status: "completed", last_request_started: "old" },
    transport: {
      getConversation: async (_id, nextSignal) => {
        signal = nextSignal!;
        const request = Promise.withResolvers<{ messages: SessionMessage[] }>();
        requests.push(request);
        return request.promise;
      },
      getQueuedMessages: async () => ({ messages: [] }),
      connectStream: (_id, handlers) => {
        streams.push(handlers);
        return { close() {} };
      },
    },
    onChange: (next) => {
      state = next;
    },
  });
  controller.connect();
  await tick();
  controller.sessionChanged({ id: "s", status: "in_progress", last_request_started: "first" });
  expect(signal.aborted).toBe(true);
  streams[0]!.onPatch!({ op: "replace", path: "/messages", value: [message("first")] });
  requests[0]!.resolve({ messages: [message("old-history")] });
  await tick();
  controller.sessionChanged({ id: "s", status: "in_progress", last_request_started: "next" });
  streams[1]!.onPatch!({ op: "replace", path: "/messages", value: [message("second")] });
  streams[0]!.onPatch!({ op: "replace", path: "/messages", value: [] });
  streams[0]!.onEnd!({});
  await tick();
  expect(state.messages).toEqual([message("second")]);
  controller.dispose();
  await registry.dispose();
});

test("a new run observed before the old stream ends owns the next connection", async () => {
  const reads = createRendererReadRegistry();
  const streams: SessionStreamHandlers[] = [];
  let state!: SessionHistoryState;
  const controller = createSessionHistoryController({
    sessionId: "s",
    ownerKey: "view",
    reads,
    initialSession: { id: "s", status: "in_progress", last_request_started: "old" },
    transport: {
      getConversation: async () => ({ messages: [] }),
      getQueuedMessages: async () => ({ messages: [] }),
      connectStream: (_id, handlers) => {
        streams.push(handlers);
        return { close() {} };
      },
    },
    onChange: (next) => {
      state = next;
    },
  });
  controller.connect();
  await tick();
  controller.sessionChanged({ id: "s", status: "in_progress", last_request_started: "new" });
  streams[0].onEnd!({});
  expect(streams).toHaveLength(2);
  streams[1].onPatch!({ op: "replace", path: "/messages", value: [message("new")] });
  expect(state.messages).toEqual([message("new")]);
  expect(state.streaming).toBe(true);
  controller.dispose();
  await reads.dispose();
});

test("authoritative queue snapshots preserve repeated prompts and reject older queue reads", async () => {
  const reads = createRendererReadRegistry();
  let handlers!: SessionStreamHandlers;
  let state!: SessionHistoryState;
  const old = Promise.withResolvers<{ messages: SessionMessage[] }>();
  const queued = (position: number) => ({
    ...message(`queued-prompt-s-${position}`),
    parts: [{ type: "text" as const, text: "repeat" }],
  });
  const controller = createSessionHistoryController({
    sessionId: "s",
    ownerKey: "view",
    reads,
    initialState: { messages: [queued(1), queued(2)], loading: false, streaming: false },
    initialSession: { id: "s", status: "in_progress" },
    transport: {
      getConversation: async () => ({ messages: [] }),
      getQueuedMessages: async () => old.promise,
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
  handlers.onQueuedMessages!({ messages: [queued(2)] });
  const confirmed = { ...message("confirmed"), parts: [{ type: "text" as const, text: "repeat" }] };
  handlers.onPatch!({ op: "replace", path: "/messages", value: [confirmed] });
  expect(state.messages).toEqual([confirmed, queued(2)]);
  old.resolve({ messages: [queued(1), queued(2)] });
  await tick();
  expect(state.messages).toEqual([confirmed, queued(2)]);
  handlers.onQueuedMessages!({ error: "Queue unavailable" });
  expect(state.messages).toEqual([confirmed, queued(2)]);
  expect(state.queueError).toEqual({ message: "Queue unavailable", temporary: true });
  controller.dispose();
  await reads.dispose();
});

test("only temporary failures are marked as worth retrying", async () => {
  const registry = createRendererReadRegistry();
  let handlers!: SessionStreamHandlers;
  let state!: SessionHistoryState;
  const controller = createSessionHistoryController({
    sessionId: "s",
    ownerKey: "placement",
    reads: registry,
    transport: {
      getConversation: async () => {
        throw Object.assign(new Error("Session not found"), { status: 404 });
      },
      getQueuedMessages: async () => {
        throw Object.assign(new Error("Queue unavailable"), { status: 503 });
      },
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
  expect(state.error).toEqual({ message: "Session not found", temporary: false });
  expect(state.queueError).toEqual({ message: "Queue unavailable", temporary: true });
  controller.sessionChanged({ id: "s", status: "in_progress", last_request_started: "run" });
  handlers.onError!(new TypeError("Failed to fetch"));
  expect(state.error).toEqual({ message: "The network is unavailable.", temporary: true });
  controller.dispose();
  await registry.dispose();
});
