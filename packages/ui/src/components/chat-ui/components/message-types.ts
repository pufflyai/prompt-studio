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

export type QueuedFollowUp = {
  id: string;
  prompt: string;
  attachments?: Array<{
    id: string;
    name: string;
    mediaType?: string;
    url?: string;
  }>;
  position?: number;
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

const isVisibleText = (part: TextPart | ReasoningPart) => part.text.trim().length > 0;

const isVisibleAlert = (part: AlertPart) => part.title.trim().length > 0 || Boolean(part.message?.trim());

const isDisplayRenderablePart = (part: ChatMessagePart) => {
  switch (part.type) {
    case "text":
    case "reasoning":
      return isVisibleText(part);
    case "tool":
    case "file":
    case "error":
      return true;
    case "alert":
      return isVisibleAlert(part);
    default:
      return false;
  }
};

const isActivityPart = (part: ChatMessagePart) => part.type === "reasoning" || part.type === "tool";

const isActivityOnlyMessage = (message: SessionMessage) => {
  if (message.role === "user") return false;
  if (message.parts.length === 0) return false;
  return message.parts.every(isActivityPart);
};

const mergeBufferedActivity = (messages: SessionMessage[]) => {
  if (messages.length === 0) return null;

  const [first, ...rest] = messages;
  if (!first) return null;

  return {
    ...first,
    role: "assistant",
    parts: messages.flatMap((message) => message.parts),
    modelId: rest.at(-1)?.modelId ?? first.modelId,
    providerId: rest.at(-1)?.providerId ?? first.providerId,
  } satisfies SessionMessage;
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

export const normalizeChatMessagesForDisplay = (messages: SessionMessage[], options: { streaming?: boolean } = {}) => {
  const normalized: SessionMessage[] = [];
  let activityBuffer: SessionMessage[] = [];

  const clearActivityBuffer = () => {
    activityBuffer = [];
  };

  for (const message of messages) {
    const displayParts = (message.parts ?? []).filter(isDisplayRenderablePart);
    if (displayParts.length === 0) continue;

    const displayMessage = { ...message, parts: displayParts };

    if (displayMessage.role === "user") {
      clearActivityBuffer();
      normalized.push(displayMessage);
      continue;
    }

    if (isActivityOnlyMessage(displayMessage)) {
      activityBuffer.push(displayMessage);
      continue;
    }

    if (activityBuffer.length > 0) {
      normalized.push({
        ...displayMessage,
        parts: [...activityBuffer.flatMap((activity) => activity.parts), ...displayMessage.parts],
      });
      clearActivityBuffer();
      continue;
    }

    normalized.push(displayMessage);
  }

  if (options.streaming && activityBuffer.length > 0) {
    const trailingActivity = mergeBufferedActivity(activityBuffer);
    if (trailingActivity) normalized.push(trailingActivity);
  }

  return normalized;
};

export interface MessageGroup {
  userMessage: SessionMessage;
  responses: SessionMessage[];
}

export const getAssistantMessageActionTargetId = (messages: SessionMessage[]) => {
  const lastMessage = messages.at(-1);
  if (lastMessage?.role !== "assistant") return null;

  const hasVisibleText = lastMessage.parts.some((part) => part.type === "text" && isVisibleText(part));
  return hasVisibleText ? lastMessage.id : null;
};

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
