import { Button } from "@chakra-ui/react";
import { AlertMessage } from "@pstdio/ui";
import { rendererReadKey } from "@pstdio/workbench";
import type { WorkbenchPanelRenderInput } from "@pstdio/workbench/react";
import type { SessionHistoryState } from "../data/session-history-controller";
import { SessionHistoryNotice } from "./session-history-notice";

interface SessionChatNoticesProps extends Pick<SessionHistoryState, "historyIssue" | "error" | "queueError"> {
  input: WorkbenchPanelRenderInput;
  sessionId: string | null;
  retryHistory(): void;
  refreshQueue(): void;
}
export const SessionChatNotices = (props: SessionChatNoticesProps) => {
  const { input, sessionId, historyIssue, error, queueError, retryHistory, refreshQueue } = props;
  return (
    <>
      {" "}
      {sessionId && (historyIssue || error) ? (
        <SessionHistoryNotice
          sessionId={sessionId}
          ownerKey={rendererReadKey(input.instance, "session")}
          reads={input.workbench.views.reads}
          issue={historyIssue}
          error={error}
          retry={retryHistory}
        />
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
