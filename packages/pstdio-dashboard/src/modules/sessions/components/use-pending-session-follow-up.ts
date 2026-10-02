import type { SessionMessage } from "@pstdio/ui/chat-ui";
import { useEffect, useState } from "react";
import {
  forgetHandedOffPendingFollowUp,
  hasAcceptedPendingFollowUp,
  mergeMessagesWithPendingFollowUp,
  type PendingFollowUpState,
  peekHandedOffPendingFollowUp,
  shouldShowPendingFollowUp,
} from "../chat/session-chat-state";
import { hasPendingSessionRunStarted, resolveSessionWorkStartedAt } from "../chat/session-work-start";

export const usePendingSessionFollowUp = (
  sessionId: string | null,
  messages: SessionMessage[],
  lastRequestStarted: string | null,
  runInProgress: boolean,
) => {
  const [pendingFollowUp, setPendingFollowUp] = useState<PendingFollowUpState | null>(() =>
    peekHandedOffPendingFollowUp(sessionId),
  );

  useEffect(() => {
    forgetHandedOffPendingFollowUp(sessionId);
  }, [sessionId]);

  useEffect(() => {
    // An unsent message stays until the user resends or removes it.
    if (!pendingFollowUp || pendingFollowUp.failure || !shouldShowPendingFollowUp(pendingFollowUp, sessionId)) return;
    if (
      hasAcceptedPendingFollowUp(messages, pendingFollowUp) &&
      hasPendingSessionRunStarted(lastRequestStarted, pendingFollowUp.previousRunStarted)
    )
      setPendingFollowUp(null);
  }, [messages, pendingFollowUp, lastRequestStarted, sessionId]);

  const visiblePending = shouldShowPendingFollowUp(pendingFollowUp, sessionId) ? pendingFollowUp : null;
  return {
    pendingFollowUp,
    pendingWork: Boolean(visiblePending && !visiblePending.failure),
    setPendingFollowUp,
    displayedMessages: mergeMessagesWithPendingFollowUp(messages, visiblePending),
    streamingStartedAt: resolveSessionWorkStartedAt(
      lastRequestStarted,
      visiblePending?.failure ? undefined : (visiblePending ?? undefined),
      runInProgress,
    ),
  };
};
