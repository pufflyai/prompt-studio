import type {
  CommandDefinition,
  CommandStreamDeclaration,
  JsonValue,
  ParamObjectSchema,
  ParamsOf,
  WebviewCommandStreamEvent,
  WebviewCommandsExecuteParams,
} from "pstdio-api-contracts/extension-kernel";
import { createStreamBuffer, jsonBytes, streamError } from "../internal/stream-buffer";
import { unwrapCommandOutcome } from "./command-outcome";
import type { GuestHost } from "./guest-host";

export interface CommandStreamOptions {
  signal?: AbortSignal;
}
export interface CommandStream<TChunk, TResult> extends AsyncIterable<TChunk> {
  readonly result: Promise<TResult>;
  cancel(): Promise<void>;
}
type StreamFn<T> =
  T extends CommandDefinition<infer S, infer R, infer _Settings, infer C>
    ? S extends ParamObjectSchema
      ? Partial<ParamsOf<S>> extends ParamsOf<S>
        ? (params?: ParamsOf<S>, options?: CommandStreamOptions) => CommandStream<C, R>
        : (params: ParamsOf<S>, options?: CommandStreamOptions) => CommandStream<C, R>
      : (params?: Record<string, never>, options?: CommandStreamOptions) => CommandStream<C, R>
    : never;
export type WebviewStreamsClient<TCommands> = {
  [K in keyof TCommands & string as TCommands[K] extends { stream?: CommandStreamDeclaration<infer C> }
    ? [C] extends [never]
      ? never
      : K
    : never]: StreamFn<TCommands[K]>;
};

export const createWebviewCommandStream = (
  host: GuestHost,
  params: WebviewCommandsExecuteParams,
  options?: CommandStreamOptions,
): CommandStream<JsonValue, unknown> => {
  const streamId = crypto.randomUUID();
  const result = Promise.withResolvers<unknown>();
  // Result may reject while the caller is still awaiting the iterable.
  void result.promise.catch(() => {});
  let ended = false;
  let unsubscribe = () => {};
  const cleanup = () => {
    unsubscribe();
    options?.signal?.removeEventListener("abort", abort);
  };
  const stop = async (code: string) => {
    if (ended) return;
    ended = true;
    cleanup();
    buffer.clear();
    result.reject(streamError(code));
    await host.call("commands.stream", { operation: "cancel", streamId }).catch(() => {});
  };
  const abort = () => {
    void stop("command_stream_cancelled");
  };
  const buffer = createStreamBuffer<JsonValue>({
    size: jsonBytes,
    limit: 8 * 1024 * 1024,
    onCancel: () => stop("command_stream_cancelled"),
    onConsume: (bytes) => {
      if (!ended)
        void host
          .call("commands.stream", { operation: "ack", streamId, bytes })
          .catch(() => stop("command_stream_disconnected"));
    },
  });
  unsubscribe = host.onEvent("commands.stream", (payload) => {
    const event = payload as WebviewCommandStreamEvent;
    if (event.streamId !== streamId || ended) return;
    if (event.type === "data") {
      if (!buffer.push(event.data)) void stop("command_stream_overflow");
      return;
    }
    ended = true;
    cleanup();
    buffer.finish();
    try {
      result.resolve(unwrapCommandOutcome({ outcome: event.outcome }));
    } catch (error) {
      result.reject(Object.assign(error as Error, { code: event.outcome.ok ? undefined : event.outcome.code }));
    }
  });
  if (options?.signal?.aborted) abort();
  else {
    options?.signal?.addEventListener("abort", abort, { once: true });
    void host.call("commands.stream", { ...params, operation: "start", streamId }).catch((error: unknown) => {
      if (ended) return;
      ended = true;
      cleanup();
      buffer.finish();
      result.reject(error);
    });
  }
  return { ...buffer.iterable, result: result.promise, cancel: () => stop("command_stream_cancelled") };
};
