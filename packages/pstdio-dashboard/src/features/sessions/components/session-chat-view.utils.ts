import type { ChatInputQuestionPrompt, SessionMessage } from "@pstdio/ui/chat-ui";
import type { PendingFollowUpState } from "./session-chat-state";

const EDIT_ACTION_TYPES = new Set(["write", "execute"]);

export const countCompletedEditActions = (messages: SessionMessage[]) => {
  let count = 0;

  for (const message of messages) {
    for (const part of message.parts) {
      if (
        part.type === "tool" &&
        part.actionType &&
        EDIT_ACTION_TYPES.has(part.actionType) &&
        part.status === "completed"
      ) {
        count += 1;
      }
    }
  }

  return count;
};

export const shouldResetPendingFollowUpForSession = (
  pendingFollowUp: PendingFollowUpState | null,
  sessionId: string | null,
) => Boolean(pendingFollowUp?.sessionId && pendingFollowUp.sessionId !== sessionId);

export const resolveNewSessionWorkspaceId = (input: {
  sessionId: string | null;
  workspaceId?: string;
  newSessionWorkspaceId?: string;
}) => {
  if (input.sessionId) {
    return input.workspaceId;
  }

  return input.newSessionWorkspaceId;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const toQuestionOption = (value: unknown) => {
  if (typeof value === "string") {
    return { label: value, description: undefined };
  }

  if (!isRecord(value) || typeof value.label !== "string") return null;
  const description =
    typeof value.description === "string" && value.description.length > 0 ? value.description : undefined;
  return { label: value.label, description };
};

const toQuestion = (value: unknown, index: number) => {
  if (!isRecord(value) || typeof value.question !== "string") return null;

  const options = Array.isArray(value.options)
    ? value.options.map(toQuestionOption).filter((option) => option !== null)
    : [];
  if (options.length === 0) return null;

  const type = typeof value.type === "string" ? value.type : undefined;
  const multiple = typeof value.multiple === "boolean" ? value.multiple : type === "multiple_choice";
  const required = typeof value.required === "boolean" ? value.required : false;
  const allowCustomAnswer =
    typeof value.custom === "boolean"
      ? value.custom
      : typeof value.allowCustomAnswer === "boolean"
        ? value.allowCustomAnswer
        : false;

  return {
    id: typeof value.id === "string" ? value.id : `question-${index}`,
    question: value.question,
    options,
    multiple,
    required,
    allowCustomAnswer,
  };
};

const parseQuestionPrompt = (value: unknown): ChatInputQuestionPrompt | undefined => {
  if (!isRecord(value) || !Array.isArray(value.questions)) return undefined;

  const questions = value.questions.map(toQuestion).filter((question) => question !== null);
  if (questions.length === 0) return undefined;

  return { questions };
};

export const getActiveQuestionPrompt = (messages: SessionMessage[]) => {
  let lastUserMessageIndex = -1;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "user") {
      lastUserMessageIndex = index;
      break;
    }
  }

  for (let messageIndex = messages.length - 1; messageIndex > lastUserMessageIndex; messageIndex -= 1) {
    const message = messages[messageIndex];

    for (let partIndex = message.parts.length - 1; partIndex >= 0; partIndex -= 1) {
      const part = message.parts[partIndex];
      if (part.type !== "tool" || part.tool.toLowerCase() !== "question") continue;

      const parsed = parseQuestionPrompt(part.state?.input);
      if (parsed) return parsed;
    }
  }

  return undefined;
};

const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled"]);

// Detects when a session transitions from a terminal state to in_progress
// while the stream is not already active (external resume by hook/CLI/API).
export const shouldReconnectForExternalResume = (
  prevStatus: string | null,
  currentStatus: string | null,
  isStreaming: boolean,
) => {
  if (!prevStatus || isStreaming) return false;
  return TERMINAL_STATUSES.has(prevStatus) && currentStatus === "in_progress";
};
