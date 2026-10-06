import type { SessionMessage } from "@pstdio/ui/chat-ui";
import { useEffect, useSyncExternalStore } from "react";
import {
  getPendingFollowUp,
  hasAcceptedPendingFollowUp,
  mergeMessagesWithPendingFollowUp,
  subscribePendingFollowUps,
  updatePendingFollowUp,
} from "../chat/session-chat-state";
import { hasPendingSessionRunStarted, resolveSessionWorkStartedAt } from "../chat/session-work-start";

export const usePendingSessionFollowUp = (
  conversationKey: string,
  messages: SessionMessage[],
  lastRequestStarted: string | null,
  runInProgress: boolean,
) => {
  const pendingFollowUp = useSyncExternalStore(subscribePendingFollowUps, () => getPendingFollowUp(conversationKey));

  useEffect(() => {
    // An unsent message stays until the user resends or removes it.
    if (!pendingFollowUp || pendingFollowUp.failure) return;
    if (
      hasAcceptedPendingFollowUp(messages, pendingFollowUp) &&
      hasPendingSessionRunStarted(lastRequestStarted, pendingFollowUp.previousRunStarted)
    )
      updatePendingFollowUp(conversationKey, (current) => (current === pendingFollowUp ? null : current));
  }, [conversationKey, messages, pendingFollowUp, lastRequestStarted]);

  return {
    pendingFollowUp,
    pendingWork: Boolean(pendingFollowUp && !pendingFollowUp.failure),
    displayedMessages: mergeMessagesWithPendingFollowUp(messages, pendingFollowUp),
    streamingStartedAt: resolveSessionWorkStartedAt(
      lastRequestStarted,
      pendingFollowUp?.failure ? undefined : (pendingFollowUp ?? undefined),
      runInProgress,
    ),
  };
};
