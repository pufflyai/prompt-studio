import fs from "node:fs";
import type { JsonPatch, SessionMessage } from "pstdio-agents";
import type { createFileService } from "../../services/file-service";
import type { createSessionService } from "../../services/session-service";

const isEmptyTextLikePart = (part: SessionMessage["parts"][number]) => {
  if (part.type !== "text" && part.type !== "reasoning") return false;
  return part.text.trim().length === 0;
};

const sanitizeMessages = (messages: SessionMessage[]) => {
  const sanitized: SessionMessage[] = [];

  for (const message of messages) {
    const parts = message.parts.filter((part) => !isEmptyTextLikePart(part));
    if (parts.length === 0) continue;
    sanitized.push({ ...message, parts });
  }

  return sanitized;
};

export const buildMessagesFromPatches = (
  patches: JsonPatch[],
  initialMessages?: SessionMessage[],
): SessionMessage[] => {
  let messages: SessionMessage[] = initialMessages ? [...initialMessages] : [];

  for (const patch of patches) {
    if (patch.path === "/messages" && (patch.op === "add" || patch.op === "replace")) {
      if (Array.isArray(patch.value)) {
        messages = [...(patch.value as SessionMessage[])];
      }
      continue;
    }

    const match = patch.path.match(/^\/messages\/(\d+)$/);
    if (!match) continue;

    const index = Number(match[1]);

    if (patch.op === "add") {
      messages.splice(index, 0, patch.value as SessionMessage);
    } else if (patch.op === "replace") {
      messages[index] = patch.value as SessionMessage;
    } else if (patch.op === "remove") {
      messages.splice(index, 1);
    }
  }

  return sanitizeMessages(messages);
};

type PersistDeps = {
  sessionService: Pick<ReturnType<typeof createSessionService>, "get" | "update">;
  fileService: Pick<ReturnType<typeof createFileService>, "get" | "upload" | "update">;
};

export const persistSessionMessages = async (sessionId: string, patches: JsonPatch[], deps: PersistDeps) => {
  const session = await deps.sessionService.get(sessionId);
  if (!session) return;

  let initialMessages: SessionMessage[] | undefined;

  // Resume case: merge with existing file content
  if (session.session_file_id) {
    const file = await deps.fileService.get(session.session_file_id);
    if (file) {
      initialMessages = JSON.parse(fs.readFileSync(file.storage_path, "utf-8"));
    }
  }

  const messages = buildMessagesFromPatches(patches, initialMessages);
  if (messages.length === 0) return;

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
};
