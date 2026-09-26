import type { SessionMessage } from "pstdio-api-contracts";
import type { SessionsRouteDeps } from "./deps";
import { resolveSessionAttachments, sessionAttachmentFileParts } from "./session-attachments";

export const getQueuedSessionMessages = async (deps: SessionsRouteDeps, projectId: string, sessionId: string) => {
  const entries = await deps.sessionQueueEntriesService.listPendingBySession(sessionId);
  const messages: SessionMessage[] = [];
  try {
    for (const entry of entries) {
      if (entry.request_kind !== "start" && entry.request_kind !== "follow_up") continue;
      const attachments = await resolveSessionAttachments(deps, projectId, entry.attachments_json ?? []);
      messages.push({
        id: `queued-prompt-${sessionId}-${entry.queue_position}`,
        role: "user",
        parts: [{ type: "text", text: entry.prompt }, ...sessionAttachmentFileParts(attachments)],
      });
    }
  } catch {
    // Deleted attachments must not prevent the confirmed conversation from opening.
    return [];
  }
  return messages;
};
