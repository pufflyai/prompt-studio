import type { Session } from "../types";

export const createSessionsNavigationSignature = (sessions: Session[]) =>
  JSON.stringify(
    sessions.map((session) => ({
      id: session.id,
      projectId: session.projectId,
      agentSessionId: session.agentSessionId,
      title: session.title,
      status: session.status,
      updatedAt: session.updatedAt,
    })),
  );
