import type { createNativeDocumentService } from "../../services/native-documents/documents";
import type { SessionEventSink } from "../sessions/session-stream-connections";
import { openNativePresenceStream } from "./stream-presence";

// Both the legacy HTTP endpoint and shared subscriptions use the same coalescing observer.
export const observeNativeDocument = async (
  service: ReturnType<typeof createNativeDocumentService>,
  room: { projectId: string; documentKey: string; roomId: string },
  stream: Pick<SessionEventSink, "aborted" | "onAbort" | "write">,
) => {
  const finished = Promise.withResolvers<void>();
  let stop: (() => void) | undefined;
  let presence: Awaited<ReturnType<typeof openNativePresenceStream>> | undefined;
  let seedId = "";
  let dirty = true;
  let draining = false;
  const cleanup = () => {
    active = false;
    stop?.();
    presence?.close();
    finished.resolve();
  };
  let failure: { error: unknown } | undefined;
  let active = !stream.aborted;
  const failed = (error: unknown) => {
    failure ??= { error };
    cleanup();
  };
  const drain = async () => {
    if (draining) return;
    draining = true;
    try {
      while (dirty && active) {
        dirty = false;
        const snapshot = await service.snapshot(room);
        seedId = snapshot.seedId;
        await send("document", {
          ...snapshot,
          state: Buffer.from(snapshot.state).toString("base64"),
          sourceState: snapshot.sourceState ? Buffer.from(snapshot.sourceState).toString("base64") : undefined,
        });
      }
    } finally {
      draining = false;
    }
  };
  const send = async (event: string, data: unknown) => {
    if (!active) return failure;
    // Closing a logical watch must not wait for the shared socket's backpressure.
    await Promise.race([stream.write(event, data), finished.promise]);
  };
  stream.onAbort(cleanup);
  try {
    if (!active) return;
    // Subscribe before taking the snapshot; a write during bootstrap schedules another drain.
    stop = await service.watch(
      room,
      () => {
        dirty = true;
        void drain().catch(failed);
      },
      cleanup,
    );
    if (!active) return failure;
    await drain();
    if (!active) return failure;
    presence = await openNativePresenceStream(
      service,
      { ...room, seedId },
      (event) => send(event.event, JSON.parse(event.data)),
      failed,
    );
    if (!active) return failure;
    await finished.promise;
  } catch (error) {
    failed(error);
  } finally {
    cleanup();
  }
  return failure;
};
