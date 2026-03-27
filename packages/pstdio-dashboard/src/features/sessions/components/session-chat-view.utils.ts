import type { SessionMessage } from "@pstdio/ui/chat-ui";
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
