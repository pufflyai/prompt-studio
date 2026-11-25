import { and, eq, sql } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { type automation_runs, automation_tokens, preferences } from "../../db/schemas.pg";

export type AutomationRunRecord = Omit<typeof automation_runs.$inferSelect, "principal"> & { principal_id: string };
export const automationRunRecord = <T extends { principal: string }>(row: T) => {
  const { principal, ...rest } = row;
  return { ...rest, principal_id: principal };
};
const releasedTokenPrefix = "automation-token-owner:";
export const releasedAutomationOwner = (id: string) => `released:${id}`;

// Keep the released owner only for migrated tokens. Revocation is recorded on
// the token, and deleting its project removes this device-local mapping.
export const releasedTokenOwnerPreference = (token: typeof automation_tokens.$inferInsert, owner: string) => ({
  scope: "project" as const,
  scope_id: token.project_id,
  project_id: token.project_id,
  extension_id: "",
  key: releasedTokenPrefix + token.id,
  sync: "device" as const,
  value: releasedAutomationOwner(owner),
  updated_at: token.created_at,
});

export const selectAutomationTokenOwners = (db: Pick<DbClient, "select">) =>
  db
    .select({ token: automation_tokens, releasedOwner: preferences.value })
    .from(automation_tokens)
    .leftJoin(
      preferences,
      and(
        eq(preferences.scope, "project"),
        eq(preferences.scope_id, automation_tokens.project_id),
        eq(preferences.extension_id, ""),
        eq(preferences.sync, "device"),
        eq(preferences.key, sql`${releasedTokenPrefix} || ${automation_tokens.id}`),
      ),
    );

export const automationTokenOwner = (token: typeof automation_tokens.$inferSelect, releasedOwner?: unknown) => ({
  id: typeof releasedOwner === "string" ? releasedOwner : `token:${token.id}`,
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
