import { and, desc, eq, inArray, ne, or, type SQL, sql } from "drizzle-orm";
import type { SetNotificationStatusInput } from "pstdio-api-contracts";
import type { DbClient } from "../../db/connection.pglite";
import { notifications } from "../../db/schemas.pg";

export const createNotificationStatusDBService = (db: DbClient) => {
  const apply = (scope: SQL[], input: SetNotificationStatusInput) =>
    db.transaction(async (tx) => {
      const items = await tx
        .select()
        .from(notifications)
        .where(and(...scope))
        .orderBy(desc(notifications.created_at), desc(notifications.id))
        .for("update");
      if (items.length === 0) return { items, updated: [] };
      const timestamp = new Date().toISOString();
      const change =
        input.status === "snoozed"
          ? or(
              ne(notifications.status, input.status),
              sql`${notifications.snoozed_until} is distinct from ${input.snoozedUntil}`,
            )
          : ne(notifications.status, input.status);
      const final = input.status === "done" || input.status === "dismissed";
      const updated = await tx
        .update(notifications)
        .set({
          status: input.status,
          updated_at: timestamp,
          snoozed_until: input.status === "snoozed" ? input.snoozedUntil : null,
          resolved_at: final ? timestamp : null,
          read_at: input.status === "read" ? timestamp : undefined,
        })
        .where(
          and(
            inArray(
              notifications.id,
              items.map((item) => item.id),
            ),
            change,
            ne(notifications.status, "expired"),
            final ? undefined : inArray(notifications.status, ["open", "read", "snoozed"]),
          ),
        )
        .returning();
      const byId = new Map(updated.map((item) => [item.id, item]));
      return { items: items.map((item) => byId.get(item.id) ?? item), updated };
    });
  return {
    setStatus: async (projectId: string, id: string, input: SetNotificationStatusInput) => {
      const result = await apply([eq(notifications.project_id, projectId), eq(notifications.id, id)], input);
      return { item: result.items[0] ?? null, changed: result.updated.length > 0 };
    },
    setStatusByKey: (projectId: string, key: string, input: SetNotificationStatusInput) =>
      apply([eq(notifications.project_id, projectId), eq(notifications.dedupe_key, key)], input),
  };
};
