import { expect, test } from "bun:test";
import type { GuestHost } from "./guest-host";
import { createWebviewCommandStream } from "./webview-streams";

const setup = () => {
  const calls: unknown[] = [];
  let listener = (_: unknown) => {};
  const host = {
    call: async (method: string, params: unknown) => {
      calls.push({ method, params });
      return { accepted: true };
    },
    onEvent: (_: string, handler: (event: unknown) => void) => {
      listener = handler;
      return () => {
        listener = () => {};
      };
    },
  } as GuestHost;
  const stream = createWebviewCommandStream(host, { commandId: "example.logs" });
  const start = calls[0] as { params: { streamId: string } };
  return { stream, calls, emit: (event: object) => listener({ streamId: start.params.streamId, ...event }) };
};

test("delivers ordered chunks and the final command value", async () => {
  const { stream, emit } = setup();
  emit({ type: "data", data: "first" });
  emit({ type: "data", data: "second" });
  emit({ type: "end", outcome: { ok: true, status: "success", value: 2 } });
  expect(await Array.fromAsync(stream)).toEqual(["first", "second"]);
  expect(await stream.result).toBe(2);
});

test("breaking iteration cancels the command and rejects its result", async () => {
  const { stream, emit, calls } = setup();
  emit({ type: "data", data: 1 });
  for await (const _ of stream) break;
  await expect(stream.result).rejects.toMatchObject({ code: "command_stream_cancelled" });
  expect(calls).toContainEqual({ method: "commands.stream", params: expect.objectContaining({ operation: "cancel" }) });
});

test("cancelling wakes a reader waiting for its next chunk", async () => {
  const { stream } = setup();
  const iterator = stream[Symbol.asyncIterator]();
  const pending = iterator.next();
  await stream.cancel();
  expect(await pending).toEqual({ done: true, value: undefined });
  await expect(stream.result).rejects.toMatchObject({ code: "command_stream_cancelled" });
});
