import { Button } from "@chakra-ui/react";
import { AlertMessage } from "@pstdio/ui";
import type { SessionHistoryState } from "../data/session-history-controller";

interface SessionChatNoticesProps extends Pick<SessionHistoryState, "historyIssue" | "error" | "queueError"> {
  refreshQueue(): void;
}
export const SessionChatNotices = (props: SessionChatNoticesProps) => {
  const { historyIssue, error, queueError, refreshQueue } = props;
  const historyBlocked = historyIssue && historyIssue.code !== "native_unavailable";
  return (
    <>
      {error ? (
        <AlertMessage status="error" title="Could not load conversation">
          {error}
        </AlertMessage>
      ) : null}
      {!error && historyBlocked ? (
        <AlertMessage status="warning" title="Conversation cannot continue">
          {historyIssue.code === "checkpoint_unreadable"
            ? "The saved conversation could not be read."
            : "The saved conversation and agent history could not be combined."}
        </AlertMessage>
      ) : null}
      {queueError ? (
        <AlertMessage
          status="warning"
          title="Could not update queued prompts"
          endElement={
            <Button size="xs" onClick={refreshQueue}>
              Retry
            </Button>
          }
        >
          {queueError}
        </AlertMessage>
      ) : null}
    </>
  );
};
