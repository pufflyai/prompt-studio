import { Button } from "@chakra-ui/react";
import { AlertMessage } from "@pstdio/ui";
import type { SessionHistoryState } from "../data/session-history-controller";

interface SessionChatNoticesProps extends Pick<SessionHistoryState, "error" | "queueError"> {
  refreshQueue(): void;
}
export const SessionChatNotices = (props: SessionChatNoticesProps) => {
  const { error, queueError, refreshQueue } = props;
  return (
    <>
      {error ? (
        <AlertMessage status="error" title="Could not load conversation">
          {error}
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
