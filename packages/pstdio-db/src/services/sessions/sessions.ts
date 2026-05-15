import { and, count, eq, inArray, isNull } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { session_queue_entries, sessions } from "../../db/schemas.pg";

type SessionRecord = typeof sessions.$inferSelect;
type SessionStatus =
  | "in_progress"
  | "awaiting_input"
  | "queued"
  | "completed"
  | "failed"
  | "cancelled"
  | "disconnected";

type CreateInput = {
  project_id: string;
  title: string;
  agent: string;
  last_selected_model?: string;
  original_session_id?: string;
  cwd?: string;
  status?: SessionStatus;
};

type CreateQueuedInput = Omit<CreateInput, "status"> & {
  prompt: string;
  request_kind: string;
  question_response_json?: unknown;
};

type QueueExistingInput = {
  id: string;
  prompt: string;
  request_kind: string;
  question_response_json?: unknown;
};

class QueueClaimFailed extends Error {}

type ListFilters = {
  status?: SessionStatus;
  agent?: string;
  workspaceId?: string;
  includeArchived?: boolean;
};

type UpdateInput = Partial<
  Pick<
    SessionRecord,
    | "title"
    | "agent"
    | "last_selected_model"
    | "agent_session_id"
    | "last_request_started"
    | "last_request_ended"
    | "session_file_id"
    | "cwd"
  >
>;

const nowTimestamp = () => new Date().toISOString();

const buildRecord = (input: CreateInput) => {
  const timestamp = nowTimestamp();

  const record: SessionRecord = {
    id: crypto.randomUUID(),
    project_id: input.project_id,
    title: input.title,
    status: input.status ?? "in_progress",
    archived: false,
    last_request_started: input.status === "queued" ? null : timestamp,
    last_request_ended: null,
    agent: input.agent,
    last_selected_model: input.last_selected_model ?? null,
    agent_session_id: null,
    session_file_id: null,
    original_session_id: input.original_session_id ?? null,
    cwd: input.cwd ?? null,
    anchors_json: [],
    created_at: timestamp,
    updated_at: timestamp,
  };

  return record;
};

export const createSessionsDBService = (db: DbClient) => {
  const create = async (input: CreateInput) => {
    const record = buildRecord(input);

    await db.insert(sessions).values(record);
    return record;
  };

  const createQueuedWithEntry = async (input: CreateQueuedInput) => {
    const record = buildRecord({ ...input, status: "queued" });
    const timestamp = nowTimestamp();

    await db.transaction(async (tx) => {
      await tx.insert(sessions).values(record);
      await tx.insert(session_queue_entries).values({
        session_id: record.id,
        prompt: input.prompt,
        request_kind: input.request_kind,
        question_response_json: input.question_response_json ?? null,
        dispatch_started_at: null,
        created_at: timestamp,
        updated_at: timestamp,
      });
    });

    return record;
  };

  const queueExistingWithEntry = async (input: QueueExistingInput) => {
    const timestamp = nowTimestamp();

    return db.transaction(async (tx) => {
      const [row] = await tx
        .update(sessions)
        .set({ status: "queued", updated_at: timestamp })
        .where(eq(sessions.id, input.id))
        .returning();
      const updated = row ?? null;

      if (updated) {
        await tx.insert(session_queue_entries).values({
          session_id: input.id,
          prompt: input.prompt,
          request_kind: input.request_kind,
          question_response_json: input.question_response_json ?? null,
          dispatch_started_at: null,
          created_at: timestamp,
          updated_at: timestamp,
        });
      }

      return updated;
    });
  };

  const claimQueuedForDispatch = async (id: string) => {
    try {
      return await db.transaction(async (tx) => {
        const timestamp = nowTimestamp();
        const [updated] = await tx
          .update(sessions)
          .set({ status: "in_progress", last_request_started: timestamp, updated_at: timestamp })
          .where(and(eq(sessions.id, id), eq(sessions.status, "queued")))
          .returning();

        if (!updated) return null;

        const [entry] = await tx
          .update(session_queue_entries)
          .set({ dispatch_started_at: timestamp, updated_at: timestamp })
          .where(and(eq(session_queue_entries.session_id, id), isNull(session_queue_entries.dispatch_started_at)))
          .returning();

        if (!entry) throw new QueueClaimFailed();

        return updated;
      });
    } catch (error) {
      if (error instanceof QueueClaimFailed) return null;
      throw error;
    }
  };

  const recoverQueuedDispatchClaim = async (id: string) => {
    const timestamp = nowTimestamp();

    return db.transaction(async (tx) => {
      const [entry] = await tx
        .update(session_queue_entries)
        .set({ dispatch_started_at: null, updated_at: timestamp })
        .where(eq(session_queue_entries.session_id, id))
        .returning();

      if (!entry) return null;

      const [updated] = await tx
        .update(sessions)
        .set({ status: "queued", updated_at: timestamp })
        .where(and(eq(sessions.id, id), eq(sessions.status, "in_progress")))
        .returning();

      return updated ?? null;
    });
  };

  const cancelQueued = async (id: string) => {
    const timestamp = nowTimestamp();

    return db.transaction(async (tx) => {
      const [updated] = await tx
        .update(sessions)
        .set({ status: "cancelled", last_request_ended: timestamp, updated_at: timestamp })
        .where(and(eq(sessions.id, id), eq(sessions.status, "queued")))
        .returning();

      if (!updated) return null;

      await tx.delete(session_queue_entries).where(eq(session_queue_entries.session_id, id));
      return updated;
    });
  };

  const archiveQueued = async (id: string) => {
    const timestamp = nowTimestamp();

    return db.transaction(async (tx) => {
      const [updated] = await tx
        .update(sessions)
        .set({ archived: true, updated_at: timestamp })
        .where(and(eq(sessions.id, id), eq(sessions.status, "queued")))
        .returning();

      if (!updated) return null;

      await tx.delete(session_queue_entries).where(eq(session_queue_entries.session_id, id));
      return updated;
    });
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

  const countActive = async () => {
    const [row] = await db
      .select({ value: count() })
      .from(sessions)
      .where(inArray(sessions.status, ["in_progress", "awaiting_input"]));
    return row?.value ?? 0;
  };

  return {
    create,
    createQueuedWithEntry,
    queueExistingWithEntry,
    claimQueuedForDispatch,
    recoverQueuedDispatchClaim,
    cancelQueued,
    archiveQueued,
    get,
    list,
    listByStatus,
    listByAgentSession,
    update,
    updateStatus,
    archive,
    countActive,
  };
};
