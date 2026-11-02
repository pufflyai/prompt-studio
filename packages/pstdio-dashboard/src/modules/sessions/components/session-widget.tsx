import type { WorkbenchPanelRenderInput } from "@pstdio/workbench/react";
import { useEffect, useState } from "react";
import type { DashboardSessionDraftPersistence } from "@/shared/app/session-draft-persistence";
import { getPendingFollowUp } from "../chat/session-chat-state";
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
  const view = resolveDashboardSessionViewForPlacement(input.instance);
  const [, refreshView] = useState(0);
  useEffect(() => {
    const refresh = () => refreshView((version) => version + 1);
    const unsubscribe = subscribeSessionData(
      input.instance.resource?.type === "session" ? input.instance.resource.id : undefined,
      refresh,
    );
    refresh();
    return unsubscribe;
  }, [input.instance]);
  const context = sessionPanelContext(input);
  const history = useDashboardSessionMessages(context, view.sessionId);
  const [identity, setIdentity] = useState({ conversationKey: view.draftKey, panelKey: view.draftKey });
  let currentIdentity = identity;
  if (identity.conversationKey !== view.draftKey) {
    const source = getPendingFollowUp(view.draftKey)?.sourceConversationKey;
    currentIdentity = {
      conversationKey: view.draftKey,
      panelKey: source === identity.conversationKey ? identity.panelKey : view.draftKey,
    };
    setIdentity(currentIdentity);
  }

  return (
    <DashboardSessionChatPanel
      // Draft, pending message, attachments and harness picks belong to one conversation. A tab that
      // switches sessions in place gets a fresh panel instead of carrying them over.
      key={currentIdentity.panelKey}
      conversationKey={currentIdentity.panelKey}
      input={context}
      view={view}
      history={history}
      drafts={drafts}
      emptyStateTitle="No messages yet"
      emptyStateDescription="Send a message to start this session."
    />
  );
};
