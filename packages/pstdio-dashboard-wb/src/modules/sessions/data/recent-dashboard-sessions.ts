import type { DashboardSession } from "./dashboard-sessions";

export const getRecentDashboardSessions = (sessions: DashboardSession[], limit: number) =>
  [...sessions].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, limit);
