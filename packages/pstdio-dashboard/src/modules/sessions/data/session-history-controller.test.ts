import { expect, test } from "bun:test";
import type { SessionStreamHandlers } from "@pstdio/sdk/client";
import type { SessionMessage } from "@pstdio/ui/chat-ui";
import { createRendererReadRegistry } from "@pstdio/workbench";
import { createSessionHistoryController, type SessionHistoryState } from "./session-history-controller";

const message = (id: string): SessionMessage => ({ id, role: "user", parts: [{ type: "text", text: id }] });
const tick = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

test("SSE owns even an empty transcript and queue edits never fetch full history", async () => {
  const registry = createRendererReadRegistry();
  const history = Promise.withResolvers<{ messages: SessionMessage[] }>();
  let handlers!: SessionStreamHandlers;
  let signal!: AbortSignal;
  let historyReads = 0;
  let queueReads = 0;
  let state!: SessionHistoryState;
  const controller = createSessionHistoryController({
    sessionId: "s",
    ownerKey: "placement",
    reads: registry,
    transport: {
      getConversation: async (_id, nextSignal) => {
        historyReads++;
        signal = nextSignal!;
        return history.promise;
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
  expect(signal.aborted).toBe(true);
  history.resolve({ messages: [message("stale")] });
  for (let i = 0; i < 1000; i++) controller.sessionChanged({ id: "s", status: "in_progress" });
  controller.sessionChanged({ id: "other", status: "in_progress" });
  await tick();
  expect(historyReads).toBe(1);
  expect(queueReads).toBe(2);
  expect(state.messages).toEqual([message("queued-prompt-s-1")]);
  controller.dispose();
  await registry.dispose();
});

test("a later run rejects the previous end GET and stale stream events", async () => {
  const registry = createRendererReadRegistry();
  const requests: ReturnType<typeof Promise.withResolvers<{ messages: SessionMessage[] }>>[] = [];
  const streams: SessionStreamHandlers[] = [];
  let state!: SessionHistoryState;
  const controller = createSessionHistoryController({
    sessionId: "s",
    ownerKey: "placement",
    reads: registry,
    transport: {
      getConversation: async () => {
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
  streams[0]!.onPatch!({ op: "replace", path: "/messages", value: [message("first")] });
  requests[0]!.resolve({ messages: [] });
  await tick();
  streams[0]!.onEnd!({});
  await tick();
  controller.sessionChanged({ id: "s", status: "in_progress", last_request_started: "next" });
  streams[1]!.onPatch!({ op: "replace", path: "/messages", value: [message("second")] });
  requests[1]!.resolve({ messages: [message("old-end")] });
  streams[0]!.onPatch!({ op: "replace", path: "/messages", value: [] });
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
    initialSession: { id: "s", last_request_started: "old" },
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
  expect(state.queueError).toBe("Queue unavailable");
  controller.dispose();
  await reads.dispose();
});
