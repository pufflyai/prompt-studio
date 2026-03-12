import type { Session } from "../types";

export const getRecentSessions = (sessions: Session[], limit: number) =>
  [...sessions].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, limit);
