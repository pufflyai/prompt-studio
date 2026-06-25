import type { DashboardSession } from "../data/dashboard-sessions";
import { getRecentDashboardSessions } from "../data/recent-dashboard-sessions";

export interface SessionBubbleGroup {
  id: string;
  label?: string;
  sessions: DashboardSession[];
}

// In a workspace the picker leads with that workspace's sessions and keeps the rest of the
// project's sessions in a second group below; elsewhere every session shares a single group.
export const buildSessionBubbleGroups = (input: {
  sessions: DashboardSession[];
  workspaceId: string | null | undefined;
  workspaceLabel?: string;
  limit: number;
}): SessionBubbleGroup[] => {
  const { sessions, workspaceId, workspaceLabel, limit } = input;

  if (!workspaceId) {
    return [{ id: "all", sessions: getRecentDashboardSessions(sessions, limit) }];
  }

  const groups: SessionBubbleGroup[] = [
    {
      id: "workspace",
      label: workspaceLabel || "This workspace",
      sessions: getRecentDashboardSessions(
        sessions.filter((session) => session.workspaceId === workspaceId),
        limit,
      ),
    },
    {
      id: "other",
      label: "Other sessions",
      sessions: getRecentDashboardSessions(
        sessions.filter((session) => session.workspaceId !== workspaceId),
        limit,
      ),
    },
  ];

  return groups.filter((group) => group.sessions.length > 0);
};
