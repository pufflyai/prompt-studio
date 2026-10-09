import type { QueuedFollowUpRequest, SessionMessage } from "pstdio-api-contracts";
import type { SessionsRouteDeps } from "./deps";
import { queuedRequest } from "./queued-request";
import { resolveSessionAttachments, sessionAttachmentFileParts } from "./session-attachments";

export const getQueuedSessionMessages = async (deps: SessionsRouteDeps, projectId: string, sessionId: string) => {
  const entries = await deps.sessionQueueEntriesService.listUndispatchedBySession(sessionId);
  return queuedMessagesFromRequests(
    deps,
    projectId,
    sessionId,
    entries.filter((entry) => entry.request_kind === "start" || entry.request_kind === "follow_up").map(queuedRequest),
  );
};

export const queuedMessagesFromRequests = async (
  deps: SessionsRouteDeps,
  projectId: string,
  sessionId: string,
  requests: QueuedFollowUpRequest[],
) => {
  const messages: SessionMessage[] = [];
  try {
    for (const entry of requests) {
      const attachments = await resolveSessionAttachments(deps, projectId, entry.attachments);
      messages.push({
        id: `queued-prompt-${sessionId}-${entry.queuePosition}`,
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
