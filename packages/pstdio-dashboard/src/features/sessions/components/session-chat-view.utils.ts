import type { SessionMessage } from "@pstdio/ui/chat-ui";
import type { SessionStatus } from "../types";
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

const ACTIVE_STATUSES = new Set<SessionStatus>(["in_progress", "awaiting_input"]);

export const canInterruptSession = (sessionStatus: SessionStatus | null, sessionId: string | null) =>
  Boolean(sessionId && sessionStatus && ACTIVE_STATUSES.has(sessionStatus));

const TERMINAL_STATUSES = new Set<SessionStatus>(["completed", "failed", "cancelled"]);

// Detects when a session transitions from a terminal state to in_progress
// while the stream is not already active (external resume by hook/CLI/API).
export const shouldReconnectForExternalResume = (
  prevStatus: SessionStatus | null,
  currentStatus: SessionStatus | null,
  isStreaming: boolean,
) => {
  if (!prevStatus || isStreaming) return false;
  return TERMINAL_STATUSES.has(prevStatus) && currentStatus === "in_progress";
};
