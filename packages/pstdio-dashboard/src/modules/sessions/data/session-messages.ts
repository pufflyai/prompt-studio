import type { SessionMessage } from "@pstdio/ui/chat-ui";
import { getApiClient } from "@/lib/api";

export interface DashboardSessionMessagePatch {
  op: "add" | "replace" | "remove";
  path: string;
  value?: unknown;
}

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

export const applyDashboardSessionMessagePatch = (messages: SessionMessage[], patch: DashboardSessionMessagePatch) => {
  if (patch.path === "/messages" && (patch.op === "add" || patch.op === "replace")) {
    if (!Array.isArray(patch.value)) return sanitizeMessages(messages);
    return sanitizeMessages(patch.value as SessionMessage[]);
  }

  const match = patch.path.match(/^\/messages\/(\d+)$/);
  if (!match) return sanitizeMessages(messages);

  const index = Number(match[1]);
  const next = [...messages];

  if (patch.op === "add") {
    next.splice(index, 0, patch.value as SessionMessage);
  } else if (patch.op === "replace") {
    next[index] = patch.value as SessionMessage;
  } else if (patch.op === "remove") {
    next.splice(index, 1);
  }

  return sanitizeMessages(next);
};

export const fetchDashboardSessionConversationMessages = async (sessionId: string) => {
  try {
    const payload = await getApiClient().sessions.getConversation(sessionId);
    if (!Array.isArray(payload.messages)) return [];

    return applyDashboardSessionMessagePatch([], {
      op: "replace",
      path: "/messages",
      value: payload.messages,
    });
  } catch {
    return null;
  }
};

export const resolveDashboardStreamEndMessages = (
  streamedMessages: SessionMessage[],
  hydratedMessages: SessionMessage[],
) => {
  if (streamedMessages.length >= hydratedMessages.length) return streamedMessages;
  return hydratedMessages;
};
