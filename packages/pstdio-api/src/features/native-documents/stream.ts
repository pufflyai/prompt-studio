import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import { apiLogger } from "../../lib/logger";
import type { createNativeDocumentService } from "../../services/native-documents/documents";
import type { AppBindings } from "../../types";
import { openNativePresenceStream } from "./stream-presence";

export const streamNativeDocument = (
  context: Context<AppBindings>,
  service: ReturnType<typeof createNativeDocumentService>,
  room: { projectId: string; documentKey: string; roomId: string },
) =>
  streamSSE(context, async (stream) => {
    const finished = Promise.withResolvers<void>();
    let stop: (() => void) | undefined;
    let presence: Awaited<ReturnType<typeof openNativePresenceStream>> | undefined;
    let seedId = "";
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let dirty = true;
    let draining = false;
    const cleanup = () => {
      stop?.();
      presence?.close();
      clearInterval(heartbeat);
      finished.resolve();
    };
    const failed = (error: unknown) => {
      if (!stream.aborted)
        apiLogger.error({ err: error, event: "native_document.stream.error" }, "Native document stream failed");
      stream.abort();
      cleanup();
    };
    const drain = async () => {
      if (draining) return;
      draining = true;
      try {
        while (dirty && !stream.aborted) {
          dirty = false;
          const snapshot = await service.snapshot(room);
          seedId = snapshot.seedId;
          await stream.writeSSE({
            event: "document",
            data: JSON.stringify({
              ...snapshot,
              state: Buffer.from(snapshot.state).toString("base64"),
              sourceState: snapshot.sourceState ? Buffer.from(snapshot.sourceState).toString("base64") : undefined,
            }),
          });
        }
      } finally {
        draining = false;
      }
    };
    stream.onAbort(cleanup);
    try {
      // Subscribe before taking the snapshot; a write during bootstrap schedules another drain.
      stop = await service.watch(
        room,
        () => {
          dirty = true;
          void drain().catch(failed);
        },
        () => stream.abort(),
      );
      if (stream.aborted) return;
      await drain();
      if (stream.aborted) return;
      presence = await openNativePresenceStream(
        service,
        { ...room, seedId },
        (event) => stream.writeSSE(event),
        failed,
      );
      if (stream.aborted) return;
      heartbeat = setInterval(() => {
        void stream.writeSSE({ event: "ping", data: "{}" }).catch(failed);
      }, 8_000);
      await finished.promise;
    } finally {
      cleanup();
    }
  });
