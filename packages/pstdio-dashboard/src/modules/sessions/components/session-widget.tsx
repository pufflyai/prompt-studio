import type { WorkbenchPanelRenderInput } from "@pstdio/workbench/react";
import { useEffect, useState } from "react";
import type { DashboardSessionDraftPersistence } from "@/shared/app/session-draft-persistence";
import { sessionPanelContext } from "../chat/session-view-context";
import { resolveDashboardSessionViewForPlacement } from "../data/dashboard-sessions";
import { subscribeSessionData } from "../data/session-data-subscription";
import { useDashboardSessionMessages } from "../hooks/use-dashboard-session-messages";
import { DashboardSessionChatPanel } from "./session-chat-panel";

interface SessionWidgetProps {
  input: WorkbenchPanelRenderInput;
  drafts?: DashboardSessionDraftPersistence;
}

export const SessionWidget = (props: SessionWidgetProps) => {
  const { input, drafts } = props;
  const [view, setView] = useState(() => resolveDashboardSessionViewForPlacement(input.instance));
  useEffect(() => {
    const refresh = () => setView(resolveDashboardSessionViewForPlacement(input.instance));
    const unsubscribe = subscribeSessionData(
      input.instance.resource?.type === "session" ? input.instance.resource.id : undefined,
      refresh,
    );
    refresh();
    return unsubscribe;
  }, [input.instance]);
  const context = sessionPanelContext(input);
  const history = useDashboardSessionMessages(context, view.sessionId);

  return (
    <DashboardSessionChatPanel
      // Draft, pending message, attachments and harness picks belong to one conversation. A tab that
      // switches sessions in place gets a fresh panel instead of carrying them over.
      key={view.draftKey}
      input={context}
      view={view}
      history={history}
      drafts={drafts}
      emptyStateTitle="No messages yet"
      emptyStateDescription="Send a message to start this session."
    />
  );
};
