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

// Startup collapse keeps the selected installation's values and fills in missing choices.
// The caller archives every retired preference before removing its original row.
export const mergeInstancePreferences = async (
  db: Pick<DbClient, "execute">,
  projectId: string,
  previousId: string,
  nextId: string,
) => {
  const condition = sql`scope='project' AND project_id=${projectId} AND scope_id=${previousId}
    AND (starts_with(key,'skill:') OR starts_with(key,'automation:') OR starts_with(key,'setting:'))`;
  await db.execute(sql`INSERT INTO preferences (scope,scope_id,extension_id,key,sync,value,project_id,updated_at)
    SELECT scope,${nextId},extension_id,key,sync,value,project_id,updated_at FROM preferences WHERE ${condition}
    ON CONFLICT DO NOTHING`);
  await db.execute(sql`DELETE FROM preferences WHERE ${condition}`);
};
