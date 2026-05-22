import type { SessionMessage } from "@pstdio/ui/chat-ui";
import { dashboardSessions, dashboardWorkspaces } from "../../workspaces/mock-data/workspaces";
import { dashboardSessionConversations } from "./session-conversations";

export { dashboardSessions };

// Everything the session chat panel needs to render one session. Resolved from
// the bubble/session widget's placement resource so switching sessions swaps the
// conversation and the workspace it belongs to.
export interface DashboardSessionView {
  id: string;
  workspaceTitle: string;
  workspaceShorthand: string;
  additions: number;
  deletions: number;
  messages: SessionMessage[];
}

const draftSessionView: DashboardSessionView = {
  id: "draft",
  workspaceTitle: "",
  workspaceShorthand: "",
  additions: 0,
  deletions: 0,
  messages: [],
};

export const resolveDashboardSessionView = (sessionId: string | undefined): DashboardSessionView => {
  const session = dashboardSessions.find((entry) => entry.id === sessionId);
  if (!session) return draftSessionView;

  const workspace = dashboardWorkspaces.find((entry) => entry.id === session.workspaceId) ?? dashboardWorkspaces[0];

  return {
    id: session.id,
    workspaceTitle: workspace.title,
    workspaceShorthand: workspace.shorthand,
    additions: workspace.additions,
    deletions: workspace.deletions,
    messages: dashboardSessionConversations[session.id] ?? [],
  };
};
