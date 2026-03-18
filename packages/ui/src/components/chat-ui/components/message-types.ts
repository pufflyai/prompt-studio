import type { SessionMessage, SessionMessagePart, ToolPart } from "../agent-types";

export type { SessionMessage, SessionMessagePart, ToolPart };

export type MessageOrigin = "user" | "assistant" | "developer";

export const getMessageOrigin = (role: string): MessageOrigin => {
  if (role === "user" || role === "assistant" || role === "developer") return role;
  return "assistant";
};

export const isReasoningToolOnlyMessage = (message: SessionMessage) => {
  const parts = message.parts ?? [];
  if (parts.length === 0) return false;

  const hasTextPart = parts.some((part) => part.type === "text" && "text" in part);
  if (hasTextPart) return false;

  return parts.some((part) => part.type === "reasoning" || part.type === "tool");
};

export const mergeReasoningToolOnlyMessages = (messages: SessionMessage[]) => {
  const merged: SessionMessage[] = [];

  for (const message of messages) {
    const previous = merged[merged.length - 1];

    if (previous && previous.role === message.role && isReasoningToolOnlyMessage(message)) {
      previous.parts = [...(previous.parts ?? []), ...(message.parts ?? [])];
      continue;
    }

    merged.push({
      ...message,
      parts: [...(message.parts ?? [])],
    });
  }

  return merged;
};

export interface MessageGroup {
  userMessage: SessionMessage;
  responses: SessionMessage[];
}

// Groups messages into turns: each group starts with a user message
// followed by all non-user messages until the next user message.
export const groupMessagesByTurn = (messages: SessionMessage[]) => {
  const groups: MessageGroup[] = [];
  const leadingResponses: SessionMessage[] = [];

  for (const message of messages) {
    if (message.role === "user") {
      groups.push({ userMessage: message, responses: [] });
    } else if (groups.length > 0) {
      groups[groups.length - 1].responses.push(message);
    } else {
      leadingResponses.push(message);
    }
  }

  return { groups, leadingResponses };
};
