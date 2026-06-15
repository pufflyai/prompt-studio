import type { DashboardSession } from "./dashboard-sessions";

export const getRecentDashboardSessions = (sessions: DashboardSession[], limit: number) =>
  [...sessions]
    .sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime())
    .slice(0, limit);
