import { and, eq, isNotNull, isNull } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { session_queue_entries } from "../../db/schemas.pg";

type QueueEntryRecord = typeof session_queue_entries.$inferSelect;

type CreateInput = Pick<QueueEntryRecord, "session_id" | "prompt" | "request_kind"> &
  Partial<Pick<QueueEntryRecord, "question_response_json" | "created_at">>;

const nowTimestamp = () => new Date().toISOString();

export const createSessionQueueEntriesDBService = (db: DbClient) => {
  const create = async (input: CreateInput) => {
    const timestamp = input.created_at ?? nowTimestamp();
    const [created] = await db
      .insert(session_queue_entries)
      .values({
        session_id: input.session_id,
        prompt: input.prompt,
        request_kind: input.request_kind,
        question_response_json: input.question_response_json ?? null,
        dispatch_started_at: null,
        created_at: timestamp,
        updated_at: timestamp,
      })
      .returning();
    return created;
  };

  const listPending = async () => {
    return db
      .select()
      .from(session_queue_entries)
      .where(isNull(session_queue_entries.dispatch_started_at))
      .orderBy(session_queue_entries.created_at, session_queue_entries.queue_position);
  };

  const listDispatchStarted = async () => {
    return db.select().from(session_queue_entries).where(isNotNull(session_queue_entries.dispatch_started_at));
  };

  const markDispatchStarted = async (sessionId: string) => {
    const timestamp = nowTimestamp();
    const [updated] = await db
      .update(session_queue_entries)
      .set({ dispatch_started_at: timestamp, updated_at: timestamp })
      .where(and(eq(session_queue_entries.session_id, sessionId), isNull(session_queue_entries.dispatch_started_at)))
      .returning();
    return updated ?? null;
  };

  const remove = async (sessionId: string) => {
    await db.delete(session_queue_entries).where(eq(session_queue_entries.session_id, sessionId));
  };

  return { create, listPending, listDispatchStarted, markDispatchStarted, remove };
};
