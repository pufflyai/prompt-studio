import { Button } from "@chakra-ui/react";
import { AlertMessage } from "@pstdio/ui";
import { useState } from "react";
import type { SessionHistoryState } from "../data/session-history-controller";

interface SessionChatNoticesProps extends Pick<SessionHistoryState, "error" | "queueError"> {
  reconnect(): void;
  refreshQueue(): void;
}

interface RecoverableNoticeProps {
  message: string;
  status: "error" | "warning";
  title: string;
  onRetry(): void;
}

// Closing hides this message only; a new failure shows its own notice.
const RecoverableNotice = (props: RecoverableNoticeProps) => {
  const { message, status, title, onRetry } = props;
  const [dismissed, setDismissed] = useState<string>();
  if (dismissed === message) return null;
  return (
    <AlertMessage
      status={status}
      title={title}
      onClose={() => setDismissed(message)}
      endElement={
        <Button size="2xs" variant="outline" onClick={onRetry}>
          Retry
        </Button>
      }
    >
      {message}
    </AlertMessage>
  );
};

export const SessionChatNotices = (props: SessionChatNoticesProps) => {
  const { error, queueError, reconnect, refreshQueue } = props;
  return (
    <>
      {error ? (
        <RecoverableNotice status="error" title="Could not load conversation" message={error} onRetry={reconnect} />
      ) : null}
      {queueError ? (
        <RecoverableNotice
          status="warning"
          title="Could not update queued prompts"
          message={queueError}
          onRetry={refreshQueue}
        />
      ) : null}
    </>
  );
};
