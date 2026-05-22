import type { WorkbenchWidgetRenderInput } from "pstdio-workbench/react";
import { resolveDashboardSessionView } from "../../../data/dashboard-data";
import { CommandPaletteReviewAction, DashboardSessionChatPanel } from "./session-chat-panel";

export const SessionWidget = (props: { input: WorkbenchWidgetRenderInput }) => {
  const { input } = props;

  // The placement resource is the open session; resolving it here is what makes
  // the bubble and session widget follow sidebar and dropdown selection.
  const view = resolveDashboardSessionView(input.placement.resource?.id);

  return (
    <DashboardSessionChatPanel
      input={input}
      view={view}
      emptyStateTitle="No messages yet"
      emptyStateDescription="Pick a session to open the conversation."
      workspaceAction={<CommandPaletteReviewAction input={input} />}
    />
  );
};
