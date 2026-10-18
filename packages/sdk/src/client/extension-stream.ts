import type {
  CommandExecuteBody,
  CommandExecuteRequest,
  CommandExecuteResponse,
  CommandExecutionResult,
  JsonValue,
} from "pstdio-api-contracts";
import { createCommandStreamController } from "../internal/command-stream";
import { createStreamBuffer, jsonBytes, streamError } from "../internal/stream-buffer";
import type { createSessionStreamTransport } from "./session-stream";

/** @deprecated Use CommandStream from @pstdio/sdk/extensions for chunks and a complete final outcome. */
export type CommandStreamClientEvent =
  | { type: "data"; data: JsonValue }
  | { type: "end"; response: CommandExecuteResponse };

/** @deprecated Use openExtensionCommandStream for chunks and a complete final outcome. */
export const streamExtensionCommand = (
  transport: ReturnType<typeof createSessionStreamTransport>,
  commandId: string,
  input: CommandExecuteRequest,
  options?: { signal?: AbortSignal },
) => {
  let close = () => {};
  const cleanup = () => {
    close();
    options?.signal?.removeEventListener("abort", abort);
  };
  const fail = (error: unknown) => {
    cleanup();
    buffer.finish(error);
  };
  const abort = () => fail(streamError("command_stream_cancelled"));
  const buffer = createStreamBuffer<CommandStreamClientEvent>({
    size: jsonBytes,
    limit: 8 * 1024 * 1024,
    onCancel: cleanup,
  });
  if (options?.signal?.aborted) {
    abort();
    return buffer.iterable;
  }
  const { projectId, ...body } = input;
  const subscription = transport.subscribe(
    { command: { project_id: projectId, command_id: commandId, body } },
    {
      onEvent(event, data) {
        if (event === "chunk") {
          if (!buffer.push({ type: "data", data: data as JsonValue })) fail(streamError("command_stream_overflow"));
        } else if (event === "end") {
          if (!buffer.push({ type: "end", response: data as CommandExecuteResponse })) {
            fail(streamError("command_stream_overflow"));
            return;
          }
          cleanup();
          buffer.finish();
        }
      },
      onError(error) {
        const code = (error as { code?: string })?.code ?? "command_stream_disconnected";
        const message = error instanceof Error ? error.message : String(error);
        fail(Object.assign(new Error(message, { cause: error }), { code }));
      },
    },
  );
  close = subscription.close;
  options?.signal?.addEventListener("abort", abort, { once: true });
  return buffer.iterable;
};

export const openExtensionCommandStream = (
  transport: ReturnType<typeof createSessionStreamTransport>,
  projectId: string,
  commandId: string,
  input: CommandExecuteBody = {},
  options?: { signal?: AbortSignal },
) => {
  let close = () => {};
  const controller = createCommandStreamController<JsonValue>({ options, onClose: () => close() });
  if (controller.closed()) return controller.stream;
  const subscription = transport.subscribe(
    { command: { project_id: projectId, command_id: commandId, body: input } },
    {
      onEvent(event, data) {
        if (event === "chunk") controller.push(data as JsonValue);
        else if (event === "end") controller.complete((data as CommandExecutionResult).outcome);
      },
      onError: controller.fail,
    },
  );
  close = subscription.close;
  if (controller.closed()) close();
  return controller.stream;
};
