import { Button } from "@chakra-ui/react";
import { AlertMessage } from "@pstdio/ui";
import { useState } from "react";
import type { SessionHistoryState, SessionNotice } from "../data/session-history-controller";

interface SessionChatNoticesProps extends Pick<SessionHistoryState, "error" | "queueError"> {
  reconnect(): void;
  refreshQueue(): void;
}

interface ChatNoticeProps {
  notice: SessionNotice;
  status: "error" | "warning";
  title: string;
  onRetry(): void;
}

// Retry is offered only for temporary failures. Closing hides this message; a new failure shows its own notice.
const ChatNotice = (props: ChatNoticeProps) => {
  const { notice, status, title, onRetry } = props;
  const [dismissed, setDismissed] = useState<string>();
  if (dismissed === notice.message) return null;
  return (
    <AlertMessage
      layout="banner"
      status={status}
      title={title}
      onClose={() => setDismissed(notice.message)}
      endElement={
        notice.temporary ? (
          <Button size="2xs" variant="outline" onClick={onRetry}>
            Retry
          </Button>
        ) : undefined
      }
    >
      {notice.message}
    </AlertMessage>
  );
};

export const SessionChatNotices = (props: SessionChatNoticesProps) => {
  const { error, queueError, reconnect, refreshQueue } = props;
  return (
    <>
      {error ? (
        <ChatNotice status="error" title="Could not load conversation" notice={error} onRetry={reconnect} />
      ) : null}
      {queueError ? (
        <ChatNotice
          status="warning"
          title="Could not update queued prompts"
          notice={queueError}
          onRetry={refreshQueue}
        />
      ) : null}
    </>
  );
};
