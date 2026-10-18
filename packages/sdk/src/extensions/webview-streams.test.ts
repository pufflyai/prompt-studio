import { expect, test } from "bun:test";
import type { CommandOutcome } from "pstdio-api-contracts/extension-kernel";
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
  expect(await stream.outcome).toEqual({ ok: true, status: "success", value: 2 });
});

test("breaking iteration cancels the command and rejects its result", async () => {
  const { stream, emit, calls } = setup();
  emit({ type: "data", data: 1 });
  for await (const _ of stream) break;
  await expect(stream.result).rejects.toMatchObject({ code: "command_stream_cancelled" });
  expect(await stream.outcome).toMatchObject({ ok: false, status: "error", code: "command_stream_cancelled" });
  expect(calls).toContainEqual({ method: "commands.stream", params: expect.objectContaining({ operation: "cancel" }) });
});

test("a rejected stream completion preserves every outcome field", async () => {
  const { stream, emit } = setup();
  const outcome = {
    ok: false,
    status: "rejected",
    code: "stale_revision",
    reason: "Changed",
    data: { revision: 2 },
    cause: { code: "concurrent_save" },
    diagnostics: [{ code: "conflict", message: "Changed", severity: "warning" }],
    notices: [{ type: "warning", message: "Reload" }],
  } satisfies CommandOutcome;
  emit({ type: "end", outcome });
  expect(await Array.fromAsync(stream)).toEqual([]);
  expect(await stream.outcome).toEqual(outcome);
  await expect(stream.result).rejects.toMatchObject({ code: "stale_revision", outcome });
});

test("cancellation before stream start makes no host calls", async () => {
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  const host = {
    call: async () => {
      calls++;
    },
    onEvent: () => () => {},
  } as unknown as GuestHost;
  const stream = createWebviewCommandStream(host, { commandId: "example.logs" }, { signal: controller.signal });
  expect(await stream.outcome).toMatchObject({ code: "command_stream_cancelled" });
  expect(await Array.fromAsync(stream)).toEqual([]);
  expect(calls).toBe(0);
});

test("stream cancellation and early return finish without a remote acknowledgement", async () => {
  const host = {
    call: async (_method: string, params: { operation: string }) =>
      params.operation === "cancel" ? new Promise(() => {}) : { accepted: true },
    onEvent: () => () => {},
  } as unknown as GuestHost;
  const stream = createWebviewCommandStream(host, { commandId: "example.logs" });
  await stream.cancel();
  expect(await stream.outcome).toMatchObject({ code: "command_stream_cancelled" });
  const iterator = createWebviewCommandStream(host, { commandId: "example.logs" })[Symbol.asyncIterator]();
  expect(await iterator.return?.()).toEqual({ done: true, value: undefined });
});

test("cancelling wakes a reader waiting for its next chunk", async () => {
  const { stream } = setup();
  const iterator = stream[Symbol.asyncIterator]();
  const pending = iterator.next();
  await stream.cancel();
  expect(await pending).toEqual({ done: true, value: undefined });
  await expect(stream.result).rejects.toMatchObject({ code: "command_stream_cancelled" });
});
