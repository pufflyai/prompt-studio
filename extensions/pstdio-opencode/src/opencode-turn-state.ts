import type { OpencodeSessionMessage } from "./opencode-types";

const MIN_EPOCH_TIMESTAMP_MS = 1_000_000_000_000;

const getTrailingAssistantMessage = (rawMessages: OpencodeSessionMessage[]) => {
  const tail = rawMessages.at(-1);
  if (!tail) {
    return null;
  }

  if ("info" in tail) {
    return tail.info?.role === "assistant" ? tail : null;
  }

  if ("role" in tail) {
    return tail.role === "assistant" ? tail : null;
  }

  return tail;
};

const getTrailingAssistantCreatedAt = (rawMessages: OpencodeSessionMessage[]) => {
  const tail = getTrailingAssistantMessage(rawMessages);
  if (!tail || !("info" in tail)) {
    return null;
  }

  const createdAt = tail.info?.time?.created;
  if (typeof createdAt !== "number" || createdAt < MIN_EPOCH_TIMESTAMP_MS) {
    return null;
  }

  return createdAt;
};

// When the agent asks a question the turn stays open (no completed timestamp)
// but the agent is idle — waiting for user input, not processing.
const hasQuestionPart = (message: OpencodeSessionMessage) => {
  const parts = "parts" in message && Array.isArray(message.parts) ? message.parts : [];
  return parts.some((part) => part.type === "tool" && part.tool?.toLowerCase() === "question");
};

const hasActiveNonQuestionToolPart = (message: OpencodeSessionMessage) => {
  const parts = "parts" in message && Array.isArray(message.parts) ? message.parts : [];

  return parts.some((part) => {
    if (part.type !== "tool") return false;
    if (part.tool?.toLowerCase() === "question") return false;

    const status = part.state?.status;
    return status !== "completed" && status !== "error" && status !== "output-error";
  });
};

export const isTurnInFlight = (rawMessages: OpencodeSessionMessage[]) => {
  const tail = getTrailingAssistantMessage(rawMessages);
  if (!tail) return false;

  return !isAssistantTurnDone(tail);
};

// Returns true only when the trailing message IS an assistant message AND it
// has finished: either the completed timestamp is set, or the agent asked a
// question (which means it is idle, waiting for user input).
// Crucially returns false when the trailing message is a user message —
// the assistant hasn't responded yet.
export const isTurnCompleted = (rawMessages: OpencodeSessionMessage[]) => {
  const tail = getTrailingAssistantMessage(rawMessages);
  if (!tail) return false;

  return isAssistantTurnDone(tail);
};

const isAssistantTurnDone = (message: OpencodeSessionMessage) => {
  if ("info" in message) {
    if (message.info?.time?.completed !== undefined) return true;

    return hasQuestionPart(message) && !hasActiveNonQuestionToolPart(message);
  }

  if ("role" in message && message.role === "assistant") {
    return true;
  }

  return false;
};

export const resolveInFlightTurnProgressAt = (input: {
  rawMessages: OpencodeSessionMessage[];
  lastProgressAt: number | null;
  snapshotChanged: boolean;
  now: number;
}) => {
  const { rawMessages, lastProgressAt, snapshotChanged, now } = input;
  if (!isTurnInFlight(rawMessages)) {
    return null;
  }

  if (lastProgressAt === null) {
    return getTrailingAssistantCreatedAt(rawMessages) ?? now;
  }

  if (snapshotChanged) {
    return now;
  }

  return lastProgressAt;
};

export const isTurnStale = (progressAt: number | null, now: number, staleTimeoutMs: number) =>
  progressAt !== null && now - progressAt >= staleTimeoutMs;
