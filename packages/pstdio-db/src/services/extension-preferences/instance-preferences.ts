import { and, eq, or, sql } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { preferences } from "../../db/schemas/preferences";

export const instancePreferenceWhere = (
  projectId: string,
  instanceId: string | undefined,
  kind: "skill" | "automation",
  key?: string,
) =>
  and(
    eq(preferences.scope, "project"),
    eq(preferences.project_id, projectId),
    instanceId !== undefined ? eq(preferences.scope_id, instanceId) : undefined,
    key === undefined ? sql`starts_with(${preferences.key}, ${`${kind}:`})` : eq(preferences.key, `${kind}:${key}`),
  );
export const instancePreferenceIdentity = (row: typeof preferences.$inferSelect) => ({
  project_id: row.project_id!,
  extension_instance_id: row.scope_id,
  updated_at: row.updated_at,
});

// A provider switch changes the composite identity, but the person's choices
// belong to the continuing project installation. Unique-key conflicts abort the
// same transaction rather than replacing another retained choice.
export const rekeyInstancePreferences = (
  db: Pick<DbClient, "update">,
  projectId: string,
  previousId: string,
  nextId: string,
) =>
  db
    .update(preferences)
    .set({ scope_id: nextId })
    .where(
      and(
        eq(preferences.scope, "project"),
        eq(preferences.project_id, projectId),
        eq(preferences.scope_id, previousId),
        or(
          sql`starts_with(${preferences.key}, 'skill:')`,
          sql`starts_with(${preferences.key}, 'automation:')`,
          sql`starts_with(${preferences.key}, 'setting:')`,
        ),
      ),
    );
