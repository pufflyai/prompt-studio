import type { SessionMessage } from "pstdio-api-contracts";
import type { createFileService } from "../../services/file-service";
import type { createSessionService } from "../../services/session-service";

type PersistDeps = {
  sessionService: Pick<ReturnType<typeof createSessionService>, "get" | "update">;
  fileService: Pick<ReturnType<typeof createFileService>, "upload" | "update">;
};

export const persistSessionMessages = async (sessionId: string, messages: SessionMessage[], deps: PersistDeps) => {
  const session = await deps.sessionService.get(sessionId);
  if (!session) return null;
  const data = Buffer.from(JSON.stringify(messages));
  if (session.session_file_id) {
    await deps.fileService.update(session.session_file_id, { data });
  } else {
    const file = await deps.fileService.upload({
      project_id: session.project_id!,
      file_name: "session-messages.json",
      file_kind: "session_messages",
      data,
      mime_type: "application/json",
    });
    await deps.sessionService.update(sessionId, { session_file_id: file.id });
  }
  return messages;
};
