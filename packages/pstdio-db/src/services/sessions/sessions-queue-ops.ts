import { and, eq, inArray, isNull } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { session_queue_entries, sessions } from "../../db/schemas.pg";

class QueueClaimFailed extends Error {}

const nowTimestamp = () => new Date().toISOString();

const REQUEUEABLE_TERMINAL_STATUSES = ["completed", "failed", "disconnected"] as const;

export const claimQueuedForDispatch = async (db: DbClient, id: string, queuePosition: number) => {
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
        .where(
          and(
            eq(session_queue_entries.queue_position, queuePosition),
            eq(session_queue_entries.session_id, id),
            isNull(session_queue_entries.dispatch_started_at),
          ),
        )
        .returning();

      if (!entry) throw new QueueClaimFailed();

      return updated;
    });
  } catch (error) {
    if (error instanceof QueueClaimFailed) return null;
    throw error;
  }
};

export const recoverQueuedDispatchClaim = async (db: DbClient, id: string, queuePosition: number) => {
  const timestamp = nowTimestamp();

  return db.transaction(async (tx) => {
    const [entry] = await tx
      .update(session_queue_entries)
      .set({ dispatch_started_at: null, updated_at: timestamp })
      .where(eq(session_queue_entries.queue_position, queuePosition))
      .returning();

    if (!entry) return null;

    const [updated] = await tx
      .update(sessions)
      .set({ status: "queued", last_request_started: null, updated_at: timestamp })
      .where(and(eq(sessions.id, id), eq(sessions.status, "in_progress")))
      .returning();

    return updated ?? null;
  });
};

export const requeueAfterTerminal = async (db: DbClient, id: string) => {
  const timestamp = nowTimestamp();

  const [updated] = await db
    .update(sessions)
    .set({ status: "queued", last_request_ended: null, updated_at: timestamp })
    .where(and(eq(sessions.id, id), inArray(sessions.status, REQUEUEABLE_TERMINAL_STATUSES)))
    .returning();

  return updated ?? null;
};

export const cancelQueued = async (db: DbClient, id: string) => {
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

export const archiveQueued = async (db: DbClient, id: string) => {
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
