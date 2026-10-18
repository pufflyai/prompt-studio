import type {
  CommandDefinition,
  CommandStreamDeclaration,
  JsonValue,
  ParamObjectSchema,
  ParamsOf,
  WebviewCommandStreamEvent,
  WebviewCommandsExecuteParams,
} from "pstdio-api-contracts/extension-kernel";
import { createCommandStreamController } from "../internal/command-stream";
import { streamError } from "../internal/stream-buffer";
import type { CommandStream, CommandStreamOptions } from "./command-stream";
import type { GuestHost } from "./guest-host";

export type { CommandStream, CommandStreamOptions } from "./command-stream";

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

export const openWebviewCommandStream = (
  host: GuestHost,
  params: WebviewCommandsExecuteParams,
  options?: CommandStreamOptions,
) => {
  const streamId = crypto.randomUUID();
  let unsubscribe = () => {};
  const controller = createCommandStreamController<JsonValue>({
    options,
    onClose: () => unsubscribe(),
    onCancel: async () => {
      await host.call("commands.stream", { operation: "cancel", streamId }).catch(() => {});
    },
    onConsume: (bytes) => {
      if (!controller.closed())
        void host
          .call("commands.stream", { operation: "ack", streamId, bytes })
          .catch((error: unknown) => controller.fail(streamError("command_stream_disconnected", String(error))));
    },
  });
  if (controller.closed()) return controller.stream;
  unsubscribe = host.onEvent("commands.stream", (payload) => {
    const event = payload as WebviewCommandStreamEvent;
    if (event.streamId !== streamId || controller.closed()) return;
    if (event.type === "data") controller.push(event.data);
    else controller.complete(event.outcome);
  });
  void host.call("commands.stream", { ...params, operation: "start", streamId }).catch(controller.fail);
  return controller.stream;
};

/** @deprecated Use openWebviewCommandStream and its complete outcome. */
export const createWebviewCommandStream = (
  host: GuestHost,
  params: WebviewCommandsExecuteParams,
  options?: CommandStreamOptions,
) => openWebviewCommandStream(host, params, options);
