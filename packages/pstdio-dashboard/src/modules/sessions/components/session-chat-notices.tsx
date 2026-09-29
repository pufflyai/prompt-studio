import { Button, Stack } from "@chakra-ui/react";
import { AlertMessage } from "@pstdio/ui";
import { useState } from "react";
import type { SessionHistoryState } from "../data/session-history-controller";
import type { SessionNotice } from "../data/session-notice";

interface UnsentMessageNotice {
  notice: SessionNotice;
  onRetry(): void;
  // Removes the unsent message and puts it back in the composer.
  onClose(): void;
}

interface SessionChatNoticesProps extends Pick<SessionHistoryState, "error" | "queueError"> {
  reconnect(): void;
  refreshQueue(): void;
  unsent?: UnsentMessageNotice;
}

interface ChatNoticeProps {
  notice: SessionNotice;
  title: string;
  onRetry(): void;
  onClose(): void;
}

// Retry is offered only for temporary failures; a permanent one would fail the same way.
const ChatNotice = (props: ChatNoticeProps) => {
  const { notice, title, onRetry, onClose } = props;
  return (
    <AlertMessage
      status="error"
      title={title}
      onClose={onClose}
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

// Problems appear in the conversation, where the user is looking. Closing a load or queue problem hides
// that message; a new failure shows again.
export const SessionChatNotices = (props: SessionChatNoticesProps) => {
  const { error, queueError, reconnect, refreshQueue, unsent } = props;
  const [dismissed, setDismissed] = useState<string[]>([]);
  const shown = (notice: SessionNotice | undefined) => notice && !dismissed.includes(notice.message);
  const dismiss = (notice: SessionNotice) => () => setDismissed((current) => [...current, notice.message]);
  if (!unsent && !shown(error) && !shown(queueError)) return null;
  return (
    <Stack gap="xs" pb="sm">
      {unsent ? (
        <ChatNotice title="Message not sent" notice={unsent.notice} onRetry={unsent.onRetry} onClose={unsent.onClose} />
      ) : null}
      {error && shown(error) ? (
        <ChatNotice title="Could not load conversation" notice={error} onRetry={reconnect} onClose={dismiss(error)} />
      ) : null}
      {queueError && shown(queueError) ? (
        <ChatNotice
          title="Could not update queued prompts"
          notice={queueError}
          onRetry={refreshQueue}
          onClose={dismiss(queueError)}
        />
      ) : null}
    </Stack>
  );
};
