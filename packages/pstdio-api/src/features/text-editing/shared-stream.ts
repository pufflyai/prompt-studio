import { nativePresenceLimits } from "pstdio-api-contracts";
import type { TextEditingEvent } from "pstdio-api-contracts/extension-kernel";
import { textError, textFailure } from "../../services/text-editing/errors";
import { textEventBufferKey } from "../../services/text-editing/events";
import type { createTextEditingService } from "../../services/text-editing/service";
import type { SessionEventSink } from "../sessions/session-stream-connections";

const unreadBytes = 8 * 1024 * 1024;
const unreadEvents = nativePresenceLimits.rooms * 4 + 1;
const eventBytes = (event: TextEditingEvent) => {
  if (event.type !== "snapshot") return Buffer.byteLength(JSON.stringify(event));
  const { state, sourceState, ...snapshot } = event.snapshot;
  return (
    Buffer.byteLength(state) +
    Buffer.byteLength(sourceState ?? "") +
    Buffer.byteLength(JSON.stringify({ ...event, snapshot }))
  );
};

export const streamTextEditingEvents = async (
  service: Pick<ReturnType<typeof createTextEditingService>, "listen">,
  input: { project_id: string; token: string },
  sink: SessionEventSink,
) => {
  if (sink.aborted) return;
  const finished = Promise.withResolvers<{ type: "closed" } | { type: "error"; error: unknown }>();
  const pending = new Map<string | symbol, { event: TextEditingEvent; bytes: number }>();
  let bytes = 0;
  let active = true;
  let stopListening = () => {};
  let wake: ReturnType<typeof Promise.withResolvers<void>> | undefined;
  const stop = (result: Parameters<typeof finished.resolve>[0] = { type: "closed" }) => {
    if (!active) return;
    active = false;
    stopListening();
    pending.clear();
    bytes = 0;
    wake?.resolve();
    finished.resolve(result);
  };
  const send = async (event: string, data: unknown) => {
    // A blocked socket owns at most this in-flight frame. Cancelling this watch must not
    // wait for it or close the shared socket carrying unrelated subscriptions.
    const result = await Promise.race([
      sink.write(event, data).then(() => ({ type: "written" as const })),
      finished.promise,
    ]);
    if (result.type === "error") throw result.error;
    return result.type === "written";
  };
  sink.onAbort(() => stop());
  if (sink.aborted) stop();
  try {
    if (!active) return;
    stopListening = service.listen({ projectId: input.project_id, token: input.token }, (event) => {
      if (!active) return;
      const key = textEventBufferKey(event);
      const size = eventBytes(event);
      bytes -= pending.get(key)?.bytes ?? 0;
      pending.delete(key);
      // Move replaced full states to the tail to preserve their cross-type member version order.
      // Failure occurrences retain their own positions even while the socket is blocked.
      pending.set(key, { event, bytes: size });
      bytes += size;
      // A previously supported large snapshot may travel alone; do not impose a new document limit.
      if (pending.size > unreadEvents || (pending.size > 1 && bytes > unreadBytes)) {
        stop({ type: "error", error: textFailure("connection_reset", "Text observation needs to reconnect", true) });
        return;
      }
      wake?.resolve();
    });
    if (!active) stopListening();
    if (!(await send("text_ready", {}))) return;
    while (active) {
      const first = pending.entries().next().value;
      if (!first) {
        wake = Promise.withResolvers<void>();
        await Promise.race([wake.promise, finished.promise]);
        continue;
      }
      const [key, next] = first;
      pending.delete(key);
      bytes -= next.bytes;
      if (!(await send("text", next.event))) return;
    }
    const result = await finished.promise;
    if (result.type === "error") throw result.error;
  } catch (error) {
    // The shared connection owns this final write. Its backpressure must not retain a stopped listener.
    if (!sink.aborted) void sink.write("text_error", textError(error)).catch(() => {});
  } finally {
    stop();
  }
};
