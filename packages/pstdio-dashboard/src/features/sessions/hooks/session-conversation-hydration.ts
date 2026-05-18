import type { SessionMessage } from "@pstdio/ui/chat-ui";
import { apiRequest } from "../../../lib/api";
import { applyMessagePatch } from "./session-stream-cache";

interface SessionConversationResponse {
  messages: SessionMessage[];
}

export const fetchSessionConversationMessages = async (sessionId: string) => {
  try {
    const payload = await apiRequest<SessionConversationResponse>(`/v1/sessions/${sessionId}/conversation`);
    if (!Array.isArray(payload.messages)) {
      return [];
    }

    return applyMessagePatch([], { op: "replace", path: "/messages", value: payload.messages });
  } catch {
    return null;
  }
};

export const resolveStreamEndMessages = (streamedMessages: SessionMessage[], cachedMessages: SessionMessage[]) => {
  if (streamedMessages.length > 0) {
    return streamedMessages;
  }

  return cachedMessages;
};
