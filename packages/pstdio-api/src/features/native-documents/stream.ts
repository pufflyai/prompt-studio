import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import { apiLogger } from "../../lib/logger";
import type { createNativeDocumentService } from "../../services/native-documents/documents";
import type { AppBindings } from "../../types";
import { observeNativeDocument } from "./observe";

/** @deprecated SDK callers subscribe to native_document on the shared client stream. */
export const streamNativeDocument = (
  context: Context<AppBindings>,
  service: ReturnType<typeof createNativeDocumentService>,
  room: { projectId: string; documentKey: string; roomId: string },
) =>
  streamSSE(context, async (stream) => {
    const heartbeat = setInterval(() => {
      void stream.writeSSE({ event: "ping", data: "{}" }).catch(() => stream.abort());
    }, 8_000);
    try {
      const failure = await observeNativeDocument(service, room, {
        get aborted() {
          return stream.aborted;
        },
        onAbort: (listener) => stream.onAbort(listener),
        write: (event, data) => stream.writeSSE({ event, data: JSON.stringify(data) }),
      });
      if (failure && !stream.aborted)
        apiLogger.error({ err: failure.error, event: "native_document.stream.error" }, "Native document stream failed");
    } finally {
      clearInterval(heartbeat);
    }
  });
