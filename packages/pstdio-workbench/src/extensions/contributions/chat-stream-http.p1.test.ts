import { expect, test } from "bun:test";
import { createClient } from "@pstdio/sdk/client";
import type { CommandOutcome, SessionMessage } from "@pstdio/sdk/extensions";
import { type ChatRendererEvent, chatRendererStreamFrames } from "pstdio-api-contracts";
import { createChatSession } from "./chat-session";

const history = (count: number, bytes = 4096): SessionMessage[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `turn-${index}`,
    role: index % 2 ? "assistant" : "user",
    parts: [{ type: "text", text: `Synthetic turn ${index}: ${"x".repeat(bytes)}` }],
  }));

// Replay the shared-stream protocol over real HTTP. Pausing after frame one
// lets the test reset the actual connection during atomic history assembly.
const createReplay = (event: ChatRendererEvent, pause: boolean) => {
  const frames = [...chatRendererStreamFrames(event)];
  const encoder = new TextEncoder();
  const first = Promise.withResolvers<void>();
  const ended = Promise.withResolvers<CommandOutcome>();
  let lifetime = new AbortController();
  let port = 0;
  let received = 0;
  let requests = 0;
  let sink: ReadableStreamDefaultController<Uint8Array>;
  const emit = (name: string, payload: unknown) =>
    sink.enqueue(encoder.encode(`event: ${name}\ndata: ${JSON.stringify(payload)}\n\n`));
  const start = () =>
    Bun.serve({
      hostname: "127.0.0.1",
      port,
      async fetch(request) {
        if (request.method === "GET")
          return new Response(
            new ReadableStream<Uint8Array>({
              start(controller) {
                sink = controller;
                emit("connected", { connection_id: "replay" });
              },
            }),
            { headers: { "content-type": "text/event-stream" } },
          );
        if (request.method === "DELETE") return Response.json({});
        requests++;
        const { subscription_id } = (await request.json()) as { subscription_id: string };
        const signal = lifetime.signal;
        void (async () => {
          for (let index = 0; index < frames.length && !signal.aborted; index++) {
            emit("chunk", { subscription_id, data: frames[index] });
            if (pause && index === 0)
              await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
          }
        })();
        return Response.json({});
      },
    });
  let server = start();
  port = server.port!;
  const client = createClient({ baseUrl: `http://127.0.0.1:${port}`, token: "" });
  return {
    first: first.promise,
    outcome: ended.promise,
    frames: frames.length,
    received: () => received,
    requests: () => requests,
    watch(signal: AbortSignal) {
      const stream = client.extensions.streamCommand("project", "replay.watch", {}, { signal });
      void stream.outcome.then(ended.resolve);
      return {
        result: stream.result,
        async *[Symbol.asyncIterator]() {
          for await (const frame of stream) {
            received++;
            yield frame;
            first.resolve();
          }
        },
      };
    },
    disconnect() {
      server.stop(true);
      lifetime.abort();
    },
    restart() {
      pause = false;
      lifetime = new AbortController();
      server = start();
    },
    close() {
      lifetime.abort();
      server.stop(true);
    },
  };
};

const waitForHistory = (
  session: ReturnType<typeof createChatSession>,
  messages: SessionMessage[],
  previous?: SessionMessage[],
) => {
  const ready = () =>
    session.getSnapshot().conversation.messages !== previous &&
    session.getSnapshot().messages.at(-1)?.id === messages.at(-1)?.id;
  if (ready()) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const unsubscribe = session.subscribe(() => {
      if (!ready()) return;
      unsubscribe();
      resolve();
    });
  });
};

for (const turns of [1, 67]) {
  test(`a real HTTP reset preserves its cause and recovers ${turns} conversation turns`, async () => {
    const messages = history(turns);
    const prior = history(1).map((message) => ({ ...message, id: "prior" }));
    const replay = createReplay({ revision: 0, snapshot: { messages } }, true);
    const session = createChatSession({
      initial: { messages: prior },
      query: async () => ({}),
      action: async () => undefined,
      watch: replay.watch,
    });
    const release = session.retain();
    try {
      await replay.first;
      replay.disconnect();
      const outcome = await replay.outcome;
      await Bun.sleep(0);
      expect(outcome).toMatchObject({ ok: false, code: "command_stream_disconnected" });
      const reportedError = session.getSnapshot().error;
      if (turns > 1) expect(session.getSnapshot().messages).toEqual(prior);
      expect(replay.received()).toBe(1);
      const previous = session.getSnapshot().conversation.messages;
      replay.restart();
      session.reconnect();
      await waitForHistory(session, messages, previous);
      expect(session.getSnapshot().conversation.messages).toEqual(messages);
      expect(session.getSnapshot().error).toBeUndefined();
      expect(replay.requests()).toBe(2);
      if (outcome.ok) throw new Error("Expected the disconnected command to fail");
      expect(reportedError).toBe(outcome.reason);
    } finally {
      release();
      await session.dispose();
      replay.close();
    }
  });
}

test("a complete 13 MiB history update crosses the real HTTP transport without truncation", async () => {
  const messages = history(192, 70 * 1024);
  const replay = createReplay({ revision: 0, snapshot: { messages } }, false);
  const session = createChatSession({ query: async () => ({}), action: async () => undefined, watch: replay.watch });
  const release = session.retain();
  try {
    await waitForHistory(session, messages);
    expect(session.getSnapshot().conversation.messages).toEqual(messages);
    expect(session.getSnapshot().error).toBeUndefined();
    expect(replay.received()).toBe(replay.frames);
    expect(replay.requests()).toBe(1);
  } finally {
    release();
    await session.dispose();
    replay.close();
  }
});
