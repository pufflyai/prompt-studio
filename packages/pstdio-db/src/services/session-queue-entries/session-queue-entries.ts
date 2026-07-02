import { and, eq, isNotNull, isNull } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { session_queue_entries } from "../../db/schemas.pg";

type QueueEntryRecord = typeof session_queue_entries.$inferSelect;

type CreateInput = Pick<QueueEntryRecord, "session_id" | "prompt" | "request_kind"> &
  Partial<
    Pick<
      QueueEntryRecord,
      "attachments_json" | "question_response_json" | "params_json" | "created_at" | "dispatch_started_at"
    >
  >;
type UpdateInput = Partial<
  Pick<
    QueueEntryRecord,
    "prompt" | "request_kind" | "attachments_json" | "question_response_json" | "params_json" | "created_at"
  >
>;

class PendingSwapFailed extends Error {}

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
        attachments_json: input.attachments_json ?? null,
        params_json: input.params_json ?? null,
        dispatch_started_at: input.dispatch_started_at ?? null,
        created_at: timestamp,
        updated_at: timestamp,
      })
      .returning();
    return created;
  };

  const createDispatchStarted = async (input: Omit<CreateInput, "dispatch_started_at">) => {
    const timestamp = nowTimestamp();
    return create({ ...input, created_at: input.created_at ?? timestamp, dispatch_started_at: timestamp });
  };

  const listPending = async () => {
    return db
      .select()
      .from(session_queue_entries)
      .where(isNull(session_queue_entries.dispatch_started_at))
      .orderBy(session_queue_entries.created_at, session_queue_entries.queue_position);
  };

  const listPendingBySession = async (sessionId: string) => {
    return db
      .select()
      .from(session_queue_entries)
      .where(and(eq(session_queue_entries.session_id, sessionId), isNull(session_queue_entries.dispatch_started_at)))
      .orderBy(session_queue_entries.queue_position);
  };

  const listDispatchStarted = async () => {
    return db.select().from(session_queue_entries).where(isNotNull(session_queue_entries.dispatch_started_at));
  };

  const markDispatchStarted = async (queuePosition: number) => {
    const timestamp = nowTimestamp();
    const [updated] = await db
      .update(session_queue_entries)
      .set({ dispatch_started_at: timestamp, updated_at: timestamp })
      .where(
        and(eq(session_queue_entries.queue_position, queuePosition), isNull(session_queue_entries.dispatch_started_at)),
      )
      .returning();
    return updated ?? null;
  };

  const updatePending = async (queuePosition: number, input: UpdateInput) => {
    const [updated] = await db
      .update(session_queue_entries)
      .set({ ...input, updated_at: nowTimestamp() })
      .where(
        and(eq(session_queue_entries.queue_position, queuePosition), isNull(session_queue_entries.dispatch_started_at)),
      )
      .returning();
    return updated ?? null;
  };

  const swapPending = async (
    firstQueuePosition: number,
    firstInput: UpdateInput,
    secondQueuePosition: number,
    secondInput: UpdateInput,
  ) => {
    try {
      return await db.transaction(async (tx) => {
        const timestamp = nowTimestamp();
        const [firstUpdated] = await tx
          .update(session_queue_entries)
          .set({ ...firstInput, updated_at: timestamp })
          .where(
            and(
              eq(session_queue_entries.queue_position, firstQueuePosition),
              isNull(session_queue_entries.dispatch_started_at),
            ),
          )
          .returning();
        if (!firstUpdated) return false;

        const [secondUpdated] = await tx
          .update(session_queue_entries)
          .set({ ...secondInput, updated_at: timestamp })
          .where(
            and(
              eq(session_queue_entries.queue_position, secondQueuePosition),
              isNull(session_queue_entries.dispatch_started_at),
            ),
          )
          .returning();
        if (!secondUpdated) throw new PendingSwapFailed();

        return true;
      });
    } catch (error) {
      if (error instanceof PendingSwapFailed) return false;
      throw error;
    }
  };

  const remove = async (queuePosition: number) => {
    await db.delete(session_queue_entries).where(eq(session_queue_entries.queue_position, queuePosition));
  };

  const removeBySession = async (sessionId: string) => {
    await db.delete(session_queue_entries).where(eq(session_queue_entries.session_id, sessionId));
  };

  return {
    create,
    createDispatchStarted,
    listPending,
    listPendingBySession,
    listDispatchStarted,
    markDispatchStarted,
    updatePending,
    swapPending,
    remove,
    removeBySession,
  };
};
