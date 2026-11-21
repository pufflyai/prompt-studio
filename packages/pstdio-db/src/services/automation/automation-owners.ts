import { and, eq } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { type automation_runs, type automation_tokens, preferences } from "../../db/schemas.pg";

export type AutomationRunRecord = Omit<typeof automation_runs.$inferSelect, "principal"> & { principal_id: string };
export const automationRunRecord = <T extends { principal: string }>(row: T) => {
  const { principal, ...rest } = row;
  return { ...rest, principal_id: principal };
};
export const automationTokenOwner = (token: typeof automation_tokens.$inferSelect) => ({
  id: `token:${token.id}`,
  name: token.name,
  created_by: token.created_by,
  disabled_at: null,
});
export const getExtensionAutomationOwner = async (
  db: Pick<DbClient, "select">,
  owner: { projectId: string; extensionId: string },
) => {
  const [disabled] = await db
    .select()
    .from(preferences)
    .where(
      and(
        eq(preferences.scope, "project"),
        eq(preferences.scope_id, owner.projectId),
        eq(preferences.extension_id, owner.extensionId),
        eq(preferences.key, "automation-disabled"),
      ),
    );
  return {
    id: `extension:${owner.extensionId}`,
    name: owner.extensionId,
    created_by: "extension",
    disabled_at: disabled ? String(disabled.value) : null,
  };
};
