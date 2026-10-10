import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { session_queue_entries } from "../../db/schemas.pg";

export const createSteeringDeliveryOperations = (db: DbClient) => ({
  listSteeringDeliveries: (sessionId?: string) =>
    db
      .select()
      .from(session_queue_entries)
      .where(
        and(
          isNotNull(session_queue_entries.steering_delivery_json),
          sessionId ? eq(session_queue_entries.session_id, sessionId) : undefined,
        ),
      )
      .orderBy(session_queue_entries.queue_position),
  claimSteering: async (queuePosition: number, revision: string, delivery: { id: string; runStartedAt: string }) => {
    const [entry] = await db
      .update(session_queue_entries)
      .set({ steering_delivery_json: delivery })
      .where(
        and(
          eq(session_queue_entries.queue_position, queuePosition),
          eq(session_queue_entries.revision, revision),
          isNull(session_queue_entries.dispatch_started_at),
          isNull(session_queue_entries.steering_delivery_json),
        ),
      )
      .returning();
    return entry ?? null;
  },
  releaseSteering: async (queuePosition: number, deliveryId: string) => {
    const [released] = await db
      .update(session_queue_entries)
      .set({ steering_delivery_json: null })
      .where(
        and(
          eq(session_queue_entries.queue_position, queuePosition),
          sql`${session_queue_entries.steering_delivery_json}->>'id' = ${deliveryId}`,
        ),
      )
      .returning();
    return released ?? null;
  },
});
