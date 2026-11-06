import type { createNativeDocumentService } from "../../services/native-documents/documents";
import type { SessionEventSink } from "../sessions/session-stream-connections";
import { observeNativeDocument } from "./observe";

export const streamNativeDocumentEvents = async (
  service: ReturnType<typeof createNativeDocumentService>,
  input: { project_id: string; document_key: string; room_id: string },
  sink: SessionEventSink,
) => {
  const failure = await observeNativeDocument(
    service,
    {
      projectId: input.project_id,
      documentKey: input.document_key,
      roomId: input.room_id,
    },
    sink,
  );
  if (sink.aborted) return;
  if (failure) {
    const error = failure.error as { code?: unknown; message?: string } | undefined;
    void sink
      .write("error", {
        message: error?.message ?? String(failure.error),
        code: typeof error?.code === "string" ? error.code : undefined,
      })
      .catch(() => {});
  } else void sink.write("end", {}).catch(() => {});
};
