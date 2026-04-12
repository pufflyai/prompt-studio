import type { SessionStatus } from "../types";
import { canStopSession } from "../utils/can-stop-session";

type GetSessionInterruptHandlerInput = {
  sessionId: string | null;
  sessionStatus: SessionStatus | null;
  isStopPending: boolean;
  hasRequestedStop: boolean;
  onStopSession: (sessionId: string) => void;
};

export const getSessionInterruptHandler = (input: GetSessionInterruptHandlerInput) => {
  const { sessionId, sessionStatus, isStopPending, hasRequestedStop, onStopSession } = input;

  if (!sessionId || !canStopSession(sessionStatus) || isStopPending || hasRequestedStop) {
    return undefined;
  }

  return () => {
    if (isStopPending || hasRequestedStop) {
      return;
    }
    onStopSession(sessionId);
  };
};
