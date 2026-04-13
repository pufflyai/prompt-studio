import type { OpencodeSessionMessage } from "./opencode-types";

const MIN_EPOCH_TIMESTAMP_MS = 1_000_000_000_000;

const getTrailingAssistantMessage = (rawMessages: OpencodeSessionMessage[]) => {
  const tail = rawMessages.at(-1);
  if (!tail || !("info" in tail) || tail.info?.role !== "assistant") {
    return null;
  }

  return tail;
};

const getTrailingAssistantCreatedAt = (rawMessages: OpencodeSessionMessage[]) => {
  const createdAt = getTrailingAssistantMessage(rawMessages)?.info?.time?.created;
  if (typeof createdAt !== "number" || createdAt < MIN_EPOCH_TIMESTAMP_MS) {
    return null;
  }

  return createdAt;
};

export const isTurnInFlight = (rawMessages: OpencodeSessionMessage[]) => {
  const tail = getTrailingAssistantMessage(rawMessages);
  if (!tail) return false;

  return tail.info?.time?.completed === undefined;
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
