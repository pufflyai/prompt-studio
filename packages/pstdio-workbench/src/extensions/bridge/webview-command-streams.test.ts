import { expect, test } from "bun:test";
import { createHostEventPublisher } from "pstdio-extensions/bridge/host";
import { createWebviewCommandStreamHandler, withFrameSignal } from "./webview-command-streams";

test("stream disconnects preserve their original transport cause", async () => {
  const events = createHostEventPublisher();
  const ended = Promise.withResolvers<unknown>();
  events.bind((event) => ended.resolve(event.payload));
  const capability = createWebviewCommandStreamHandler(events);
  await capability(
    { operation: "start", streamId: "s1", commandId: "logs" },
    {
      publish: () => {},
      async *stream() {
        yield* [];
        throw new Error("Socket lost", { cause: { source: "transport", retryable: false } });
      },
    },
  );
  expect(await ended.promise).toMatchObject({
    type: "end",
    outcome: {
      ok: false,
      status: "error",
      code: "command_stream_disconnected",
      reason: "Socket lost",
      cause: { source: "transport", retryable: false },
      error: { name: "Error", message: "Socket lost", cause: { source: "transport", retryable: false } },
    },
  });
});

test("disconnect aborts plain commands", async () => {
  const events = createHostEventPublisher();
  const pending = withFrameSignal(events, async (signal) => {
    await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
    return signal.aborted;
  });
  events.unbind();
  expect(await pending).toBe(true);
});

test("disconnect aborts a live stream without buffering stale events", async () => {
  const events = createHostEventPublisher();
  const received: unknown[] = [];
  events.bind((event) => received.push(event.payload));
  const capability = createWebviewCommandStreamHandler(events);
  let signal!: AbortSignal;
  const deps = {
    async *stream(_input: unknown, streamSignal: AbortSignal) {
      signal = streamSignal;
      yield { type: "data" as const, data: 1 };
      await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
    },
    publish: () => {},
  };
  await capability({ operation: "start", streamId: "s1", commandId: "logs" }, deps);
  await Promise.resolve();
  events.unbind();
  expect(signal.aborted).toBe(true);
  events.bind((event) => received.push(event.payload));
  expect(received).toEqual([{ streamId: "s1", type: "data", data: 1 }]);
});

test("unread data cancels at the frame buffer limit", async () => {
  const events = createHostEventPublisher();
  const received: { type: string; outcome?: { code?: string } }[] = [];
  events.bind((event) => received.push(event.payload as never));
  const capability = createWebviewCommandStreamHandler(events);
  const done = Promise.withResolvers<void>();
  let signal!: AbortSignal;
  await capability(
    { operation: "start", streamId: "s1", commandId: "logs" },
    {
      publish: () => {},
      async *stream(_input, streamSignal) {
        signal = streamSignal;
        try {
          for (let i = 0; i < 200; i++) yield { type: "data", data: "x".repeat(65530) };
        } finally {
          done.resolve();
        }
      },
    },
  );
  await done.promise;
  expect(signal.aborted).toBe(true);
  expect(received.at(-1)).toMatchObject({ type: "end", outcome: { code: "command_stream_overflow" } });
  expect(received.filter((event) => event.type === "data")).toHaveLength(128);
});
