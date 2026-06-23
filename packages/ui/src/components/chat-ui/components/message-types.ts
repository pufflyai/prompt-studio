// Keep the non-alert session parts aligned with pstdio-api-contracts/src/session-messages.ts.
// @pstdio/ui cannot import that private package, so the public UI contract owns this copy.
export type SessionMessageRole = "user" | "assistant" | "tool" | "system" | "developer";

export type TextPart = { type: "text"; text: string };

export type ReasoningPart = { type: "reasoning"; text: string };

export type ToolPartActionType = "read" | "write" | "execute" | "network" | "other";

export type ToolPartStatus = "pending" | "running" | "completed" | "failed" | "denied";

export type ToolPart = {
  type: "tool";
  tool: string;
  callId?: string;
  actionType?: ToolPartActionType;
  status?: ToolPartStatus;
  state?: {
    status?: string;
    input?: unknown;
    output?: unknown;
    errorText?: string;
    metadata?: unknown;
  };
};

export type StepStartPart = { type: "step-start"; snapshot?: string };

export type StepFinishPart = {
  type: "step-finish";
  reason?: string;
  snapshot?: string;
  cost?: number;
  tokens?: unknown;
};

export type PatchPart = { type: "patch"; hash?: string; files?: unknown };

export type FilePart = {
  type: "file";
  fileId?: string;
  mediaType?: string;
  filename?: string;
  size?: number;
  url: string;
};

export type LoadingPart = { type: "loading" };

export type ErrorPart = {
  type: "error";
  errorType: "timeout" | "crash" | "permission" | "other";
  message?: string;
};

export type TokenUsagePart = {
  type: "token_usage";
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
};

export type AlertPart = {
  type: "alert";
  status: "info" | "warning" | "error" | "success" | "loading";
  title: string;
  message?: string;
};

export type SessionMessagePart =
  | TextPart
  | ReasoningPart
  | ToolPart
  | StepStartPart
  | StepFinishPart
  | PatchPart
  | FilePart
  | LoadingPart
  | ErrorPart
  | TokenUsagePart;

export type ChatMessagePart = SessionMessagePart | AlertPart;

export type SessionMessage = {
  id: string;
  role: SessionMessageRole;
  parts: ChatMessagePart[];
  index?: number;
  createdAt?: number;
  modelId?: string;
  providerId?: string;
  tokens?: {
    input?: number;
    output?: number;
    reasoning?: number;
    cache?: { read?: number; write?: number };
  };
};

export type MessageOrigin = "user" | "assistant" | "developer";

export const getMessageOrigin = (role: string): MessageOrigin => {
  if (role === "user" || role === "assistant" || role === "developer") return role;
  return "assistant";
};

const isReasoningToolOnlyMessage = (message: SessionMessage) => {
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
