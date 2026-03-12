import fs from "node:fs";
import type { JsonPatch, SessionMessage } from "pstdio-agents";
import type { createSessionsService } from "pstdio-db";
import type { createFilesService } from "pstdio-storage";

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

  return messages;
};

type PersistDeps = {
  sessionsService: Pick<ReturnType<typeof createSessionsService>, "get" | "update">;
  filesService: Pick<ReturnType<typeof createFilesService>, "get" | "upload" | "update">;
};

export const persistSessionMessages = async (sessionId: string, patches: JsonPatch[], deps: PersistDeps) => {
  const session = await deps.sessionsService.get(sessionId);
  if (!session) return;

  let initialMessages: SessionMessage[] | undefined;

  // Resume case: merge with existing file content
  if (session.session_file_id) {
    const file = await deps.filesService.get(session.session_file_id);
    if (file) {
      initialMessages = JSON.parse(fs.readFileSync(file.storage_path, "utf-8"));
    }
  }

  const messages = buildMessagesFromPatches(patches, initialMessages);
  if (messages.length === 0) return;

  const data = Buffer.from(JSON.stringify(messages));

  if (session.session_file_id) {
    await deps.filesService.update(session.session_file_id, { data });
  } else {
    const file = await deps.filesService.upload({
      project_id: session.project_id!,
      file_name: "session-messages.json",
      file_kind: "session_messages",
      data,
      mime_type: "application/json",
    });
    await deps.sessionsService.update(sessionId, { session_file_id: file.id });
  }
};
