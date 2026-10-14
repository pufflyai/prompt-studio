import { and, eq, isNull } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { session_queue_entries, sessions } from "../../db/schemas.pg";
import { sessionColumns } from "../legacy-resource-links";
import { insertSessionExit } from "./session-exit";
import { nextSessionRunStart } from "./session-run-start";

export type SessionStatusGuards = {
  exitCause?: string;
  expectedLastRequestEnded?: string | null;
  expectedLastRequestStarted?: string | null;
  /** Refuse the write unless the row still holds this status. */
  expectedStatus?: typeof sessions.$inferSelect.status;
};

const matchesGuards = (
  current: Pick<typeof sessions.$inferSelect, "last_request_started" | "last_request_ended" | "status">,
  options: SessionStatusGuards | undefined,
) => {
  if (
    options?.expectedLastRequestStarted !== undefined &&
    current.last_request_started !== options.expectedLastRequestStarted
  )
    return false;
  if (
    options?.expectedLastRequestEnded !== undefined &&
    current.last_request_ended !== options.expectedLastRequestEnded
  )
    return false;
  if (options?.expectedStatus !== undefined && current.status !== options.expectedStatus) return false;

  return true;
};

export const updateSessionStatus = async (
  db: DbClient,
  id: string,
  status: typeof sessions.$inferSelect.status,
  options?: SessionStatusGuards,
) =>
  db.transaction(async (tx) => {
    const [current] = await tx.select(sessionColumns).from(sessions).where(eq(sessions.id, id)).for("update");
    if (!current) return null;
    if (!matchesGuards(current, options)) return null;
    // Cleanup cannot reinterpret an execution that has already been cancelled. A later explicit stop can claim intent.
    if (current.status === "cancelled" && status === "cancelled" && options?.exitCause !== "user_stop") return current;
    const timestamp = new Date(
      Math.max(Date.now(), Date.parse(current.last_request_ended ?? "") + 1 || 0),
    ).toISOString();
    const terminal =
      status === "completed" || status === "failed" || status === "cancelled" || status === "disconnected";
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
      .returning(sessionColumns);

    if (terminal && updated) await insertSessionExit(tx, updated, options?.exitCause);

    // Cleanup shares the guarded transition's row lock, so it cannot delete a replacement run's work.
    if (status === "cancelled" || (current.status === "queued" && terminal)) {
      await tx
        .delete(session_queue_entries)
        .where(and(eq(session_queue_entries.session_id, id), isNull(session_queue_entries.steering_delivery_json)));
    }
    return updated;
  });
