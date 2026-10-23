import type { WorkbenchCore } from "@pstdio/workbench";
import { useWorkbenchStore } from "@pstdio/workbench/react";
import type { DashboardSessionDraftPersistence } from "@/shared/app/session-draft-persistence";
import type { SessionViewContext } from "../chat/session-view-context";
import { resolveDashboardSessionViewForResource } from "../data/dashboard-sessions";
import { useDashboardSessionMessages } from "../hooks/use-dashboard-session-messages";
import { DashboardSessionChatPanel } from "./session-chat-panel";

interface NewSessionPageProps {
  workbench: WorkbenchCore;
  drafts?: DashboardSessionDraftPersistence;
}

export const NewSessionPage = (props: NewSessionPageProps) => {
  const { workbench, drafts } = props;
  const state = useWorkbenchStore(workbench.pages.store, (value) => value);
  if (!state.location || !state.projectId) return null;
  const input: SessionViewContext = {
    workbench,
    region: "main",
    owner: { kind: "page", projectId: state.projectId, location: state.location },
  };
  return <NewSessionComposer key={state.location.resource?.id ?? state.projectId} input={input} drafts={drafts} />;
};

const NewSessionComposer = (props: { input: SessionViewContext; drafts?: DashboardSessionDraftPersistence }) => {
  const { input, drafts } = props;
  const resource = input.owner.kind === "page" ? input.owner.location.resource : undefined;
  const view = resolveDashboardSessionViewForResource(resource?.type === "session-draft" ? resource : undefined);
  const history = useDashboardSessionMessages(input, undefined);
  return (
    <DashboardSessionChatPanel
      input={input}
      view={view}
      history={history}
      drafts={drafts}
      emptyStateTitle="New session"
      emptyStateDescription="Send a message to start a session."
      workspaceAction={undefined}
    />
  );
};
