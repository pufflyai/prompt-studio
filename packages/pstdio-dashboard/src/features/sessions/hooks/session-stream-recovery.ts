import type { SessionMessage } from "@pstdio/ui/chat-ui";

const SESSION_STREAM_RECONNECT_BASE_DELAY_MS = 1_000;
const SESSION_STREAM_RECONNECT_MAX_DELAY_MS = 5_000;

export const resolveRecoveredStreamMessages = (
  currentMessages: SessionMessage[],
  hydratedMessages: SessionMessage[] | null,
) => {
  if (!hydratedMessages) {
    return currentMessages;
  }

  if (hydratedMessages.length < currentMessages.length) {
    return currentMessages;
  }

  if (JSON.stringify(hydratedMessages) === JSON.stringify(currentMessages)) {
    return currentMessages;
  }

  return hydratedMessages;
};

export const getSessionStreamReconnectDelayMs = (retryCount: number) =>
  Math.min(
    SESSION_STREAM_RECONNECT_BASE_DELAY_MS * 2 ** Math.max(0, retryCount),
    SESSION_STREAM_RECONNECT_MAX_DELAY_MS,
  );
