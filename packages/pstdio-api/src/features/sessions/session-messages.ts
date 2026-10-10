import type { SessionMessage } from "pstdio-api-contracts";
import type { ExtensionSessionUsage } from "pstdio-api-contracts/extension-kernel";
import type { createFileService } from "../../services/file-service";
import type { createSessionService } from "../../services/session-service";

type PersistDeps = {
  sessionService: Pick<ReturnType<typeof createSessionService>, "get" | "update">;
  fileService: Pick<ReturnType<typeof createFileService>, "upload" | "update">;
};

export const persistSessionMessages = async (sessionId: string, messages: SessionMessage[], deps: PersistDeps) => {
  const session = await deps.sessionService.get(sessionId);
  if (!session) return null;
  let usage: ExtensionSessionUsage | null = null;
  for (const message of messages)
    for (const part of message.parts) {
      if (part.type !== "token_usage") continue;
      usage ??= { input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, cache_write_tokens: 0 };
      usage.input_tokens += part.inputTokens;
      usage.output_tokens += part.outputTokens;
      usage.cache_read_tokens += part.cacheReadTokens ?? 0;
      usage.cache_write_tokens += part.cacheWriteTokens ?? 0;
    }
  const data = Buffer.from(JSON.stringify(messages));
  if (session.session_file_id) {
    await deps.fileService.update(session.session_file_id, { data });
    await deps.sessionService.update(sessionId, { usage_json: usage });
  } else {
    const file = await deps.fileService.upload({
      project_id: session.project_id!,
      file_name: "session-messages.json",
      file_kind: "session_messages",
      data,
      mime_type: "application/json",
    });
    await deps.sessionService.update(sessionId, { session_file_id: file.id, usage_json: usage });
  }
  return messages;
};
