import type { SessionMessage } from "@pstdio/ui/chat-ui";
import { buildApiUrl } from "../../../lib/api";
import { applyMessagePatch } from "./session-stream-cache";

interface SessionConversationResponse {
  messages: SessionMessage[];
}

const getSessionConversationUrl = (sessionId: string) => buildApiUrl(`/v1/sessions/${sessionId}/conversation`);

export const fetchSessionConversationMessages = async (sessionId: string) => {
  try {
    const response = await fetch(getSessionConversationUrl(sessionId));
    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as SessionConversationResponse;
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
