import { and, count, eq, inArray } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { type ResourceRef, session_queue_entries, sessions } from "../../db/schemas.pg";
import {
  archiveQueued,
  cancelQueued,
  claimQueuedForDispatch,
  recoverQueuedDispatchClaim,
  requeueAfterTerminal,
} from "./sessions-queue-ops";

type SessionRecord = typeof sessions.$inferSelect;
type HarnessParamsJson = Record<string, string | boolean>;
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
  params_json?: HarnessParamsJson;
  anchors?: ResourceRef[];
  status?: SessionStatus;
};

type CreateQueuedInput = Omit<CreateInput, "status"> & {
  prompt: string;
  request_kind: string;
  question_response_json?: unknown;
  attachments_json?: Array<{ file_id: string }>;
  params_json?: HarnessParamsJson;
};

type QueueExistingInput = {
  id: string;
  prompt: string;
  request_kind: string;
  question_response_json?: unknown;
  attachments_json?: Array<{ file_id: string }>;
  params_json?: HarnessParamsJson;
};

type ListFilters = {
  status?: SessionStatus;
  agent?: string;
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
    | "params_json"
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
    params_json: input.params_json ?? null,
    anchors_json: input.anchors ?? [],
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
        attachments_json: input.attachments_json ?? null,
        params_json: input.params_json ?? null,
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

      if (!updated) return { session: null, entry: null };

      const [entry] = await tx
        .insert(session_queue_entries)
        .values({
          session_id: input.id,
          prompt: input.prompt,
          request_kind: input.request_kind,
          question_response_json: input.question_response_json ?? null,
          attachments_json: input.attachments_json ?? null,
          params_json: input.params_json ?? null,
          dispatch_started_at: null,
          created_at: timestamp,
          updated_at: timestamp,
        })
        .returning();

      return { session: updated, entry: entry ?? null };
    });
  };

  const insertEntryForActive = async (input: QueueExistingInput) => {
    const timestamp = nowTimestamp();

    const [entry] = await db
      .insert(session_queue_entries)
      .values({
        session_id: input.id,
        prompt: input.prompt,
        request_kind: input.request_kind,
        question_response_json: input.question_response_json ?? null,
        attachments_json: input.attachments_json ?? null,
        params_json: input.params_json ?? null,
        dispatch_started_at: null,
        created_at: timestamp,
        updated_at: timestamp,
      })
      .returning();

    return entry ?? null;
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
    insertEntryForActive,
    claimQueuedForDispatch: (id: string, queuePosition: number) => claimQueuedForDispatch(db, id, queuePosition),
    recoverQueuedDispatchClaim: (id: string, queuePosition: number) =>
      recoverQueuedDispatchClaim(db, id, queuePosition),
    requeueAfterTerminal: (id: string) => requeueAfterTerminal(db, id),
    cancelQueued: (id: string) => cancelQueued(db, id),
    archiveQueued: (id: string) => archiveQueued(db, id),
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
