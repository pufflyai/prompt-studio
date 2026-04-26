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

const parseJsonObjectText = (value: string) => {
  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const toQuestionPromptRecord = (value: unknown) => {
  if (isRecord(value)) return value;

  if (typeof value === "string" && value.trim().length > 0) {
    return parseJsonObjectText(value);
  }

  return null;
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

  const type = typeof value.type === "string" ? value.type : undefined;
  const multiple =
    typeof value.multiple === "boolean" ? value.multiple : type === "multiple_choice" || type === "multi_choice";
  const required = typeof value.required === "boolean" ? value.required : false;
  const allowCustomAnswer =
    typeof value.custom === "boolean"
      ? value.custom
      : typeof value.allowCustomAnswer === "boolean"
        ? value.allowCustomAnswer
        : type === "freeform" || type === "text";

  if (options.length === 0 && !allowCustomAnswer) return null;

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
  const record = toQuestionPromptRecord(value);
  if (!record || !Array.isArray(record.questions)) return undefined;

  const questions = record.questions.map(toQuestion).filter((question) => question !== null);
  if (questions.length === 0) return undefined;

  return { questions };
};

const hasQuestionResponsePayload = (part: Extract<SessionMessage["parts"][number], { type: "tool" }>) => {
  const output = part.state?.output;
  if (typeof output === "string" && output.trim().length > 0) return true;
  if (Array.isArray(output) && output.length > 0) return true;
  if (isRecord(output) && Object.keys(output).length > 0) return true;
  if (output !== undefined && output !== null && typeof output !== "string") return true;

  const metadata = part.state?.metadata;
  if (!isRecord(metadata)) return false;
  const answers = metadata.answers;
  if (typeof answers === "string") return answers.trim().length > 0;
  if (Array.isArray(answers)) return answers.length > 0;
  return answers !== undefined && answers !== null;
};

const isQuestionPartAwaitingResponse = (part: SessionMessage["parts"][number]) => {
  if (part.type !== "tool" || part.tool.toLowerCase() !== "question") return false;
  return !hasQuestionResponsePayload(part);
};

const getActiveQuestionPromptEntry = (messages: SessionMessage[]) => {
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
      if (part.type !== "tool") continue;
      if (!isQuestionPartAwaitingResponse(part)) continue;

      const parsed = parseQuestionPrompt(part.state?.input);
      if (parsed) {
        return {
          questionPrompt: parsed,
          signature: JSON.stringify({
            messageId: message.id,
            partIndex,
            callId: part.callId ?? "",
            questionPrompt: parsed,
          }),
        };
      }
    }
  }

  return undefined;
};

export const getActiveQuestionPrompt = (messages: SessionMessage[]) => {
  return getActiveQuestionPromptEntry(messages)?.questionPrompt;
};

export const getActiveQuestionPromptSignature = (questionPrompt: ChatInputQuestionPrompt | undefined) => {
  if (!questionPrompt) return "";
  return JSON.stringify(questionPrompt);
};

export const getVisibleActiveQuestionPromptState = (
  messages: SessionMessage[],
  suppressedQuestionPromptSignature: string,
) => {
  const entry = getActiveQuestionPromptEntry(messages);
  if (!entry) return { questionPrompt: undefined, signature: "" };

  if (entry.signature === suppressedQuestionPromptSignature) {
    return { questionPrompt: undefined, signature: "" };
  }

  return entry;
};

export const getVisibleActiveQuestionPrompt = (messages: SessionMessage[], suppressedQuestionPromptSignature: string) =>
  getVisibleActiveQuestionPromptState(messages, suppressedQuestionPromptSignature).questionPrompt;

const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled"]);
const INTERRUPTIBLE_STATUSES = new Set(["in_progress", "awaiting_input"]);

export const isSessionInterruptible = (status: string | null) => Boolean(status && INTERRUPTIBLE_STATUSES.has(status));

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
