import { and, eq, isNotNull } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { session_queue_entries } from "../../db/schemas.pg";

export const setDispatchSenderBoundary = (db: DbClient, position: number, afterTurn: number) =>
  db.transaction(async (tx) => {
    const [entry] = await tx
      .select()
      .from(session_queue_entries)
      .where(
        and(eq(session_queue_entries.queue_position, position), isNotNull(session_queue_entries.dispatch_started_at)),
      )
      .for("update");
    if (!entry?.sender_json) return null;
    if (entry.sender_json.afterTurn !== undefined) return entry;
    const [updated] = await tx
      .update(session_queue_entries)
      .set({ sender_json: { ...entry.sender_json, afterTurn } })
      .where(eq(session_queue_entries.queue_position, position))
      .returning();
    return updated ?? null;
  });
