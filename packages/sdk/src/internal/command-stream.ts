import type { CommandOutcome } from "pstdio-api-contracts/extension-kernel";
import { serializeCommandError } from "pstdio-api-contracts/extension-kernel";
import { getCommandValue } from "../extensions/command-outcome";
import type { CommandStream, CommandStreamOptions } from "../extensions/command-stream";
import { createStreamBuffer, jsonBytes, streamError } from "./stream-buffer";

export const createCommandStreamController = <TChunk, TResult = unknown>(input: {
  options?: CommandStreamOptions;
  onClose: () => void;
  onCancel?: () => Promise<void>;
  onConsume?: (bytes: number) => void;
}) => {
  const outcome = Promise.withResolvers<CommandOutcome<TResult>>();
  const result = outcome.promise.then(getCommandValue);
  void result.catch(() => {});
  let ended = false;
  const cleanup = () => {
    input.options?.signal?.removeEventListener("abort", abort);
    input.onClose();
  };
  const complete = (value: CommandOutcome<TResult>) => {
    if (ended) return;
    ended = true;
    cleanup();
    buffer.finish();
    outcome.resolve(value);
  };
  const fail = (error: unknown) => {
    if (ended) return;
    const code = (error as { code?: string })?.code ?? "command_stream_disconnected";
    const serialized = serializeCommandError(error);
    complete({
      ok: false,
      status: "error",
      code,
      reason: serialized.message,
      error: serialized,
      ...(serialized.cause !== undefined ? { cause: serialized.cause } : {}),
    });
    void input.onCancel?.().catch(() => {});
  };
  const cancel = async () => {
    if (ended) return;
    complete({ ok: false, status: "error", code: "command_stream_cancelled", reason: "Command stream cancelled." });
    buffer.clear();
    void input.onCancel?.().catch(() => {});
  };
  const abort = () => {
    void cancel();
  };
  const buffer = createStreamBuffer<TChunk>({
    size: jsonBytes,
    limit: 8 * 1024 * 1024,
    onCancel: cancel,
    onConsume: input.onConsume,
  });
  const stream: CommandStream<TChunk, TResult> = { ...buffer.iterable, outcome: outcome.promise, result, cancel };
  if (input.options?.signal?.aborted) {
    complete({ ok: false, status: "error", code: "command_stream_cancelled", reason: "Command stream cancelled." });
  } else input.options?.signal?.addEventListener("abort", abort, { once: true });
  return {
    stream,
    complete,
    fail,
    closed: () => ended,
    push: (chunk: TChunk) => {
      if (!buffer.push(chunk)) {
        fail(streamError("command_stream_overflow"));
      }
    },
  };
};
