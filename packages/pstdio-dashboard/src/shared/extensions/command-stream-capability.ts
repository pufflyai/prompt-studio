import type { CommandExecuteResponse } from "@pstdio/sdk/api";
import type { CommandStreamClientEvent, ExtensionClient } from "@pstdio/sdk/client";
import type { CommandOutcome, WebviewCommandsStreamParams } from "@pstdio/sdk/extensions";
import type { HostEventPublisher } from "pstdio-extensions/bridge/host";

const errorOutcome = (code: string, reason = code): CommandOutcome => ({ ok: false, status: "error", code, reason });
const failureOutcome = (error: unknown) =>
  errorOutcome(
    (error as { code?: string })?.code ?? "command_stream_disconnected",
    error instanceof Error ? error.message : String(error),
  );
const fail = (code: string) => Object.assign(new Error(code), { code });
const MAX_STREAMS = 16;
const MAX_UNREAD_BYTES = 8 * 1024 * 1024;

export const withFrameSignal = async <T>(hostEvents: HostEventPublisher, run: (signal: AbortSignal) => Promise<T>) => {
  const controller = new AbortController();
  const unsubscribe = hostEvents.onDisconnect(() => controller.abort());
  try {
    return await run(controller.signal);
  } finally {
    unsubscribe();
  }
};

interface StreamCapabilityDeps {
  projectId: string;
  stream: ExtensionClient["stream"];
  publish(response: CommandExecuteResponse): void;
}

/** State belongs to a frame, across React renders and bridge reconnects. */
export const createCommandStreamCapability = (hostEvents: HostEventPublisher) => {
  const streams = new Map<string, { unread: number; stop: (code: string, emit?: boolean) => void }>();
  return async (input: WebviewCommandsStreamParams, deps: StreamCapabilityDeps) => {
    const { streamId } = input;
    if (input.operation === "cancel") streams.get(streamId)?.stop("command_stream_cancelled");
    else if (input.operation === "ack") {
      const state = streams.get(streamId);
      if (state && Number.isSafeInteger(input.bytes) && input.bytes > 0 && input.bytes <= state.unread)
        state.unread -= input.bytes;
    } else {
      if (streams.has(streamId)) throw fail("command_stream_duplicate");
      if (streams.size >= MAX_STREAMS) throw fail("command_stream_limit");
      const controller = new AbortController();
      let ended = false;
      let unsubscribe = () => {};
      const emit = (payload: object) =>
        hostEvents.emit({ scope: "commands.stream", payload: { streamId, ...payload } });
      const finish = (outcome: CommandOutcome, notify = true) => {
        if (ended) return;
        ended = true;
        streams.delete(streamId);
        unsubscribe();
        controller.abort();
        if (notify) emit({ type: "end", outcome });
      };
      const state = { unread: 0, stop: (code: string, notify = true) => finish(errorOutcome(code), notify) };
      streams.set(streamId, state);
      unsubscribe = hostEvents.onDisconnect(() => state.stop("command_stream_cancelled", false));
      const { operation: _, streamId: _streamId, commandId, ...body } = input;
      const receive = (event: CommandStreamClientEvent) => {
        if (event.type === "end") {
          deps.publish(event.response);
          finish(event.response.outcome as CommandOutcome);
          return;
        }
        state.unread += new TextEncoder().encode(JSON.stringify(event.data)).byteLength;
        if (state.unread > MAX_UNREAD_BYTES) state.stop("command_stream_overflow");
        else emit(event);
      };
      const run = async () => {
        try {
          for await (const event of deps.stream(
            commandId,
            { ...body, projectId: deps.projectId, source: "dashboard" },
            { signal: controller.signal },
          )) {
            if (ended) break;
            receive(event);
          }
          if (!ended) state.stop("command_stream_disconnected");
        } catch (error) {
          finish(failureOutcome(error));
        }
      };
      void run();
    }
    return { operation: input.operation, accepted: true as const };
  };
};
