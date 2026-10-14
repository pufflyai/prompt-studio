import type { SessionMessage } from "@pstdio/ui/chat-ui";
import { useEffect, useSyncExternalStore } from "react";
import { serverShowsPendingFollowUp } from "../chat/queued-follow-ups";
import {
  getPendingFollowUp,
  mergeMessagesWithPendingFollowUp,
  subscribePendingFollowUps,
  updatePendingFollowUp,
} from "../chat/session-chat-state";
import { resolveSessionWorkStartedAt } from "../chat/session-work-start";

export const usePendingSessionFollowUp = (
  conversationKey: string,
  sessionId: string | null,
  messages: SessionMessage[],
  lastRequestStarted: string | null,
  runInProgress: boolean,
) => {
  const pendingFollowUp = useSyncExternalStore(subscribePendingFollowUps, () => getPendingFollowUp(conversationKey));

  useEffect(() => {
    // An unsent message stays until the user resends or removes it.
    if (!pendingFollowUp || pendingFollowUp.failure) return;
    if (serverShowsPendingFollowUp(messages, sessionId, pendingFollowUp, lastRequestStarted))
      updatePendingFollowUp(conversationKey, (current) => (current === pendingFollowUp ? null : current));
  }, [conversationKey, sessionId, messages, pendingFollowUp, lastRequestStarted]);

  return {
    pendingFollowUp,
    pendingWork: Boolean(pendingFollowUp && !pendingFollowUp.failure && pendingFollowUp.destination === "conversation"),
    displayedMessages: mergeMessagesWithPendingFollowUp(messages, pendingFollowUp),
    streamingStartedAt: resolveSessionWorkStartedAt(
      lastRequestStarted,
      pendingFollowUp?.failure ? undefined : (pendingFollowUp ?? undefined),
      runInProgress,
    ),
  };
};
