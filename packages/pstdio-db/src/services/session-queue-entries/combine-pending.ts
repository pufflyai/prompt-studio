import { and, eq, inArray, isNull } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { session_queue_entries } from "../../db/schemas.pg";

export interface CombinePendingInput {
  sessionId: string;
  sourcePosition: number;
  targetPosition: number;
  sourceRevision: string;
  targetRevision: string;
}

const orderedParams = (params: Record<string, string | boolean> | null) =>
  JSON.stringify(Object.entries(params ?? {}).sort(([a], [b]) => a.localeCompare(b)));

export const combinePending = (db: DbClient, input: CombinePendingInput) =>
  db.transaction(async (tx) => {
    if (input.sourcePosition === input.targetPosition) return null;
    // Lock in queue order so competing combinations cannot partially consume each other.
    const entries = await tx
      .select()
      .from(session_queue_entries)
      .where(
        and(
          eq(session_queue_entries.session_id, input.sessionId),
          inArray(session_queue_entries.queue_position, [input.sourcePosition, input.targetPosition]),
          isNull(session_queue_entries.dispatch_started_at),
          isNull(session_queue_entries.steering_delivery_json),
        ),
      )
      .orderBy(session_queue_entries.queue_position)
      .for("update");
    const source = entries.find((entry) => entry.queue_position === input.sourcePosition);
    const target = entries.find((entry) => entry.queue_position === input.targetPosition);
    if (!source || !target || source.revision !== input.sourceRevision || target.revision !== input.targetRevision)
      return null;
    if (
      source.request_kind !== "follow_up" ||
      target.request_kind !== "follow_up" ||
      source.question_response_json ||
      target.question_response_json
    )
      return null;
    if (source.model !== target.model || orderedParams(source.params_json) !== orderedParams(target.params_json))
      return null;
    const attachments = [
      ...new Map(
        [...(target.attachments_json ?? []), ...(source.attachments_json ?? [])].map((ref) => [ref.file_id, ref]),
      ).values(),
    ];
    const [combined] = await tx
      .update(session_queue_entries)
      .set({
        prompt: entries
          .map((entry) => entry.prompt)
          .filter(Boolean)
          .join("\n\n"),
        attachments_json: attachments,
        revision: crypto.randomUUID(),
        updated_at: new Date().toISOString(),
      })
      .where(eq(session_queue_entries.queue_position, target.queue_position))
      .returning();
    await tx.delete(session_queue_entries).where(eq(session_queue_entries.queue_position, source.queue_position));
    return combined ?? null;
  });
