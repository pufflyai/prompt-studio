import type { SyncedRow } from "@/lib/sync";
import type { Session } from "../types";

export const toSession = (row: SyncedRow): Session => ({
  id: row.id,
  projectId: (row.project_id as string) ?? null,
  agentSessionId: (row.agent_session_id as string) ?? null,
  title: row.title as string,
  status: row.status as Session["status"],
  archived: row.archived as boolean,
  agent: (row.agent as string) ?? null,
  lastSelectedModel: (row.last_selected_model as string) ?? null,
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string,
});

export const getVisibleSessions = (sessions: Session[]) => sessions.filter((session) => !session.archived);

export const sortSessionsByUpdatedAt = (sessions: Session[]) =>
  [...sessions].sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
