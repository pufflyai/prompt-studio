import { expect, test } from "bun:test";
import { createCommandStreamWriter } from "./command-stream";

test("writes preserve order and wait for the reader", async () => {
  const received: unknown[] = [];
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const stream = createCommandStreamWriter(async (chunk) => {
    await gate;
    received.push(chunk);
  }, new AbortController().signal);
  let finished = false;
  const writing = stream.write({ line: "one" }).then(() => {
    finished = true;
  });
  await Promise.resolve();
  expect(finished).toBe(false);
  release();
  await writing;
  await stream.write({ line: "two" });
  expect(received).toEqual([{ line: "one" }, { line: "two" }]);
});

test("oversized chunks reject without closing the writer", async () => {
  const received: unknown[] = [];
  const stream = createCommandStreamWriter(async (chunk) => {
    received.push(chunk);
  }, new AbortController().signal);
  await expect(stream.write("x".repeat(65536))).rejects.toMatchObject({ code: "command_stream_chunk_too_large" });
  await stream.write("ok");
  expect(received).toEqual(["ok"]);
});

test("cancellation releases a blocked writer and rejects later writes", async () => {
  const controller = new AbortController();
  const stream = createCommandStreamWriter(() => new Promise(() => {}), controller.signal);
  const pending = stream.write("line");
  controller.abort();
  await expect(pending).rejects.toMatchObject({ code: "command_stream_closed" });
  await expect(stream.write("late")).rejects.toMatchObject({ code: "command_stream_closed" });
});

test("ordinary calls discard chunks immediately", async () => {
  const stream = createCommandStreamWriter(undefined, new AbortController().signal);
  await stream.write("x".repeat(100000));
});

test("concurrent writes drain in order without exceeding the active socket write", async () => {
  const received: number[] = [];
  const gate = Promise.withResolvers<void>();
  let active = 0;
  let maxActive = 0;
  const stream = createCommandStreamWriter(async (chunk) => {
    active++;
    maxActive = Math.max(maxActive, active);
    await gate.promise;
    received.push((chunk as { index: number }).index);
    active--;
  }, new AbortController().signal);
  const writes = Array.from({ length: 300 }, (_, index) => stream.write({ index, log: "x".repeat(8000) }));
  await Promise.resolve();
  expect(received).toHaveLength(0);
  gate.resolve();
  await Promise.all(writes);
  expect(received).toEqual(Array.from({ length: 300 }, (_, index) => index));
  expect(maxActive).toBe(1);
});

test("the invocation closes its writer before returning the final outcome", async () => {
  const { makeRunner } = await import("./test-helpers.test");
  let writer!: { write(chunk: string): Promise<void> };
  const chunks: unknown[] = [];
  const runner = makeRunner({
    commands: [
      {
        id: "stream",
        ref: { kind: "command", id: "stream" },
        title: "Stream",
        stream: { kind: "stream" },
        run(ctx) {
          writer = ctx.stream;
          return "done";
        },
      },
    ],
  });
  const result = await runner.execute({
    commandId: "pstdio.lab.command.stream",
    projectId: "p1",
    onChunk: async (chunk) => {
      chunks.push(chunk);
    },
  });
  expect(result).toMatchObject({ ok: true, value: "done" });
  await expect(writer.write("late")).rejects.toMatchObject({ code: "command_stream_closed" });
  expect(chunks).toEqual([]);
});
