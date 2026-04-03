import { and, eq } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { sessions } from "../../db/schemas.pg";

type SessionRecord = typeof sessions.$inferSelect;
type SessionStatus = "in_progress" | "awaiting_input" | "completed" | "failed" | "cancelled";

type CreateInput = {
  project_id: string;
  title: string;
  agent: string;
  original_session_id?: string;
  cwd?: string;
};

type ListFilters = {
  status?: SessionStatus;
  agent?: string;
  workspaceId?: string;
  includeArchived?: boolean;
};

type UpdateInput = Partial<
  Pick<
    SessionRecord,
    "title" | "agent" | "agent_session_id" | "last_request_started" | "last_request_ended" | "session_file_id" | "cwd"
  >
>;

const nowTimestamp = () => new Date().toISOString();

export const createSessionsDBService = (db: DbClient) => {
  const create = async (input: CreateInput) => {
    const timestamp = nowTimestamp();

    const record: SessionRecord = {
      id: crypto.randomUUID(),
      project_id: input.project_id,
      title: input.title,
      status: "in_progress",
      archived: false,
      created: timestamp,
      last_request_started: timestamp,
      last_request_ended: null,
      agent: input.agent,
      agent_session_id: null,
      session_file_id: null,
      original_session_id: input.original_session_id ?? null,
      cwd: input.cwd ?? null,
      created_at: timestamp,
      updated_at: timestamp,
    };

    await db.insert(sessions).values(record);
    return record;
  };

  const get = async (id: string) => {
    const [row] = await db.select().from(sessions).where(eq(sessions.id, id));
    return row ?? null;
  };

  const list = async (projectId: string, filters?: ListFilters) => {
    const conditions = [eq(sessions.project_id, projectId)];

    if (!filters?.includeArchived) {
      conditions.push(eq(sessions.archived, false));
    }

    if (filters?.status) {
      conditions.push(eq(sessions.status, filters.status));
    }

    if (filters?.agent) {
      conditions.push(eq(sessions.agent, filters.agent));
    }

    const rows = await db
      .select()
      .from(sessions)
      .where(and(...conditions))
      .orderBy(sessions.created_at);

    return rows;
  };

  const update = async (id: string, input: UpdateInput) => {
    const [updated] = await db
      .update(sessions)
      .set({ ...input, updated_at: nowTimestamp() })
      .where(eq(sessions.id, id))
      .returning();
    return updated ?? null;
  };

  const updateStatus = async (id: string, status: SessionStatus) => {
    const sets: Partial<SessionRecord> = { status, updated_at: nowTimestamp() };

    if (status === "completed" || status === "failed" || status === "cancelled") {
      sets.last_request_ended = nowTimestamp();
    }

    const [updated] = await db.update(sessions).set(sets).where(eq(sessions.id, id)).returning();
    return updated ?? null;
  };

  const archive = async (id: string) => {
    const [updated] = await db
      .update(sessions)
      .set({ archived: true, updated_at: nowTimestamp() })
      .where(eq(sessions.id, id))
      .returning();
    return updated ?? null;
  };

  const listByStatus = async (status: SessionStatus) => {
    const rows = await db.select().from(sessions).where(eq(sessions.status, status));
    return rows;
  };

  const listByAgentSession = async (agent: string, agentSessionId: string) => {
    const rows = await db
      .select()
      .from(sessions)
      .where(
        and(eq(sessions.agent, agent), eq(sessions.agent_session_id, agentSessionId), eq(sessions.archived, false)),
      )
      .orderBy(sessions.created_at);
    return rows;
  };

  return { create, get, list, listByStatus, listByAgentSession, update, updateStatus, archive };
};
