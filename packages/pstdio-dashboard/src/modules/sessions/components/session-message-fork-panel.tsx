import type { ComponentProps } from "react";
import { dashboardCommandIds } from "@/shared/app/commands";
import type { SessionViewContext } from "../chat/session-view-context";
import type { DashboardSessionView } from "../data/dashboard-sessions";
import { SessionQueuedChatPanel } from "./session-queued-chat-panel";

interface SessionMessageForkPanelProps extends ComponentProps<typeof SessionQueuedChatPanel> {
  forkContext: { input: SessionViewContext; view: DashboardSessionView };
}

export const SessionMessageForkPanel = (props: SessionMessageForkPanelProps) => {
  const {
    forkContext: { input, view },
    ...panel
  } = props;
  const { sessionId } = panel;
  return (
    <SessionQueuedChatPanel
      {...panel}
      onForkMessage={
        sessionId && !view.device
          ? async (messageId) => {
              await input.workbench.commands.executeCommand(dashboardCommandIds.forkSession, { sessionId, messageId });
            }
          : undefined
      }
    />
  );
};
