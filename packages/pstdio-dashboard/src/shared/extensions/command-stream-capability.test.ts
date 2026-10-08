import { expect, test } from "bun:test";
import { createHostEventPublisher } from "pstdio-extensions/bridge/host";
import { createCommandStreamCapability, withFrameSignal } from "./command-stream-capability";

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
  const capability = createCommandStreamCapability(events);
  let signal!: AbortSignal;
  const deps = {
    async *stream(_commandId: string, _input: unknown, options?: { signal?: AbortSignal }) {
      signal = options!.signal!;
      yield { type: "data" as const, data: 1 };
      await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
    },
    publish: () => {},
    projectId: "p1",
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
  const capability = createCommandStreamCapability(events);
  const done = Promise.withResolvers<void>();
  let signal!: AbortSignal;
  await capability(
    { operation: "start", streamId: "s1", commandId: "logs" },
    {
      projectId: "p1",
      publish: () => {},
      async *stream(_command, _input, options) {
        signal = options!.signal!;
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
