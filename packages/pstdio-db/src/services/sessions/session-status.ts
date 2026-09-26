import { eq } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { session_queue_entries, sessions } from "../../db/schemas.pg";
import { nextSessionRunStart } from "./session-run-start";

export const updateSessionStatus = async (
  db: DbClient,
  id: string,
  status: typeof sessions.$inferSelect.status,
  options?: { expectedLastRequestStarted: string | null },
) =>
  db.transaction(async (tx) => {
    const [current] = await tx.select().from(sessions).where(eq(sessions.id, id)).for("update");
    if (!current || (options && current.last_request_started !== options.expectedLastRequestStarted)) return null;

    const timestamp = new Date().toISOString();
    const terminal = status === "completed" || status === "failed" || status === "cancelled";
    const [updated] = await tx
      .update(sessions)
      .set({
        status,
        updated_at: timestamp,
        ...(status === "in_progress" && {
          last_request_started: nextSessionRunStart(timestamp),
          last_request_ended: null,
        }),
        ...(terminal && { last_request_ended: timestamp }),
      })
      .where(eq(sessions.id, id))
      .returning();

    // Cleanup shares the guarded transition's row lock, so it cannot delete a replacement run's work.
    if (status === "cancelled" || (current.status === "queued" && (terminal || status === "disconnected"))) {
      await tx.delete(session_queue_entries).where(eq(session_queue_entries.session_id, id));
    }
    return updated;
  });
