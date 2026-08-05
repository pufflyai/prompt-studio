import fs from "node:fs";
import type { JsonPatch, SessionMessage } from "pstdio-api-contracts";
import type { createFileService } from "../../services/file-service";
import type { createSessionService } from "../../services/session-service";

const isEmptyTextLikePart = (part: SessionMessage["parts"][number]) => {
  if (part.type !== "text" && part.type !== "reasoning") return false;
  return part.text.trim().length === 0;
};

const sanitizeMessages = (messages: SessionMessage[]) => {
  const sanitized: SessionMessage[] = [];

  for (const message of messages) {
    // A replace patch landing past the current length leaves sparse holes; skip them.
    if (!message) continue;

    const parts = message.parts.filter((part) => !isEmptyTextLikePart(part));
    if (parts.length === 0) continue;
    sanitized.push({ ...message, parts });
  }

  return sanitized;
};

// A harness transcript can omit persisted-only messages such as token usage.
// Align the first resumed add with the end of the persisted conversation so
// follow-up patches cannot be inserted into an earlier turn.
export const resolveMessagePatchIndexOffset = (patches: JsonPatch[], initialCount: number) => {
  if (initialCount === 0) return 0;

  const firstIndexedPatch = patches.find((p) => /^\/messages\/\d+$/.test(p.path) && p.op === "add");
  if (!firstIndexedPatch) return 0;

  const firstIndex = Number(firstIndexedPatch.path.match(/\/messages\/(\d+)/)![1]);
  if (firstIndex < initialCount) return initialCount - firstIndex;

  return 0;
};

export const buildMessagesFromPatches = (
  patches: JsonPatch[],
  initialMessages?: SessionMessage[],
): SessionMessage[] => {
  let messages: SessionMessage[] = initialMessages ? [...initialMessages] : [];
  const indexOffset = resolveMessagePatchIndexOffset(patches, initialMessages?.length ?? 0);

  for (const patch of patches) {
    if (patch.path === "/messages" && (patch.op === "add" || patch.op === "replace")) {
      if (Array.isArray(patch.value)) {
        messages = [...(patch.value as SessionMessage[])];
      }
      continue;
    }

    const match = patch.path.match(/^\/messages\/(\d+)$/);
    if (!match) continue;

    const index = Number(match[1]) + indexOffset;

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
  if (!session) return null;

  let initialMessages: SessionMessage[] | undefined;

  // Resume case: merge with existing file content
  if (session.session_file_id) {
    const file = await deps.fileService.get(session.session_file_id);
    if (file) {
      initialMessages = JSON.parse(fs.readFileSync(file.storage_path, "utf-8"));
    }
  }

  const messages = buildMessagesFromPatches(patches, initialMessages);
  if (messages.length === 0) return null;

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
