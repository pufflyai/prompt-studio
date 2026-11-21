import { and, eq, sql } from "drizzle-orm";
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
