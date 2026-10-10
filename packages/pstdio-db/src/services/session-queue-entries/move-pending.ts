import { and, eq, isNull } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { session_queue_entries } from "../../db/schemas.pg";

export interface MovePendingInput {
  sessionId: string;
  queuePosition: number;
  direction: "up" | "down";
  steps: number;
  expectedRevision?: string;
  expectedOrder?: { queuePosition: number; revision: string }[];
}

export const movePending = (db: DbClient, input: MovePendingInput) =>
  db.transaction(async (tx) => {
    const entries = await tx
      .select()
      .from(session_queue_entries)
      .where(
        and(
          eq(session_queue_entries.session_id, input.sessionId),
          isNull(session_queue_entries.dispatch_started_at),
          isNull(session_queue_entries.steering_delivery_json),
        ),
      )
      .orderBy(session_queue_entries.queue_position)
      .for("update");
    if (
      input.expectedOrder &&
      (input.expectedOrder.length !== entries.length ||
        entries.some(
          (entry, index) =>
            entry.queue_position !== input.expectedOrder![index].queuePosition ||
            entry.revision !== input.expectedOrder![index].revision,
        ))
    )
      return null;
    const index = entries.findIndex((entry) => entry.queue_position === input.queuePosition);
    const source = entries[index];
    if (!source || (input.expectedRevision && source.revision !== input.expectedRevision)) return null;
    const destination = index + (input.direction === "up" ? -input.steps : input.steps);
    if (destination < 0 || destination >= entries.length) return null;
    const reordered = [...entries];
    reordered.splice(index, 1);
    reordered.splice(destination, 0, source);
    const timestamp = new Date().toISOString();
    for (let offset = Math.min(index, destination); offset <= Math.max(index, destination); offset++) {
      const entry = reordered[offset];
      await tx
        .update(session_queue_entries)
        .set({
          prompt: entry.prompt,
          request_kind: entry.request_kind,
          model: entry.model,
          params_json: entry.params_json,
          attachments_json: entry.attachments_json,
          question_response_json: entry.question_response_json,
          created_at: entry.created_at,
          updated_at: timestamp,
          revision: crypto.randomUUID(),
        })
        .where(eq(session_queue_entries.queue_position, entries[offset].queue_position));
    }
    return { session_id: input.sessionId, queuePosition: entries[destination].queue_position };
  });
