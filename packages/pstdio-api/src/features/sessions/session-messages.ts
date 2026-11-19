import { createHash } from "node:crypto";
import type { SessionMessage } from "pstdio-api-contracts";
import type { ExtensionSessionUsage } from "pstdio-api-contracts/extension-kernel";
import type { createFileService } from "../../services/file-service";
import type { createSessionService } from "../../services/session-service";

type PersistDeps = {
  sessionService: Pick<ReturnType<typeof createSessionService>, "get" | "update">;
  fileService: Pick<ReturnType<typeof createFileService>, "upload" | "update">;
};

export const latestReply = (messages: SessionMessage[]) => {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]!;
    if (message.role === "assistant" && message.parts.some((part) => part.type === "text" && part.text.trim()))
      return {
        id: message.id,
        textDigest: createHash("sha256")
          .update(JSON.stringify(message.parts.filter((part) => part.type === "text").map((part) => part.text)))
          .digest("hex"),
      };
    if (message.role === "user") break;
  }
};

export const sameReply = (a: ReturnType<typeof latestReply> | null, b: ReturnType<typeof latestReply> | null) =>
  a?.id === b?.id && a?.textDigest === b?.textDigest;

export const persistSessionMessages = async (
  sessionId: string,
  messages: SessionMessage[],
  deps: PersistDeps,
  completedReply?: { id: string; textDigest: string },
) => {
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
  const contentEvent = completedReply ? { kind: "reply" as const, ...completedReply } : undefined;
  const data = Buffer.from(JSON.stringify(messages));
  if (session.session_file_id) {
    await deps.fileService.update(session.session_file_id, { data });
    await deps.sessionService.update(sessionId, { usage_json: usage, contentEvent });
  } else {
    const file = await deps.fileService.upload({
      project_id: session.project_id!,
      file_name: "session-messages.json",
      file_kind: "session_messages",
      data,
      mime_type: "application/json",
    });
    await deps.sessionService.update(sessionId, { session_file_id: file.id, usage_json: usage, contentEvent });
  }
  return messages;
};
