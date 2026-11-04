import { AlertMessage } from "@pstdio/ui";
import type { SessionAttachment } from "pstdio-api-contracts";
import type { ReactNode } from "react";
import { clearPendingFollowUp } from "../chat/session-chat-actions";
import type { PendingFollowUpState } from "../chat/session-chat-state";
import { sessionUnsentActions } from "../chat/session-unsent-actions";
import type { SessionHistoryState } from "../data/session-history-controller";
import { SessionApprovalRequests } from "./session-approval-requests";
import { SessionChatNotices } from "./session-chat-notices";

interface SessionChatFeedbackProps {
  sessionId: string | null;
  unavailable: boolean;
  history: SessionHistoryState & { reconnect(): void; refreshQueue(): unknown };
  interrupt: { error: Error | null; reset(): void };
  pending: PendingFollowUpState | null;
  draftKey: string;
  send: Parameters<typeof sessionUnsentActions>[1]["send"];
  restore(text: string, attachments: SessionAttachment[]): void;
  children: ReactNode;
}

export const SessionChatFeedback = (props: SessionChatFeedbackProps) => {
  const { sessionId, unavailable, history, interrupt, pending, draftKey, send, restore, children } = props;
  const unsent = pending?.failure
    ? {
        notice: pending.failure,
        ...sessionUnsentActions(pending, { clear: () => clearPendingFollowUp(draftKey, pending), send, restore }),
      }
    : undefined;
  return (
    <>
      {sessionId ? (
        <SessionApprovalRequests
          sessionId={sessionId}
          requests={history.approvalRequests ?? []}
          disabled={unavailable}
        />
      ) : null}
      {children}
      {interrupt.error ? (
        <AlertMessage status="error" title="Could not interrupt" onClose={() => interrupt.reset()}>
          {interrupt.error.message}
        </AlertMessage>
      ) : null}
      <SessionChatNotices
        error={history.error}
        queueError={history.queueError}
        reconnect={history.reconnect}
        refreshQueue={history.refreshQueue}
        unsent={unsent}
      />
    </>
  );
};
