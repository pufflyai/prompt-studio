import { and, eq, sql } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { type automation_runs, automation_tokens, preferences } from "../../db/schemas.pg";

export type AutomationRunRecord = Omit<typeof automation_runs.$inferSelect, "principal"> & { principal_id: string };
export type AutomationPrincipal = {
  id: string;
  project_id: string;
  name: string;
  created_by: string;
  created_at: string;
  disabled_at: string | null;
};
export type AutomationOwnerClient = Pick<DbClient, "select" | "insert" | "delete">;
const ownerKey = "automation-owner:";
const disabledKey = (id: string) => `automation-disabled:${id}`;
export const extensionPrincipalId = (owner: { projectId: string; extensionId: string }) =>
  `extension:${JSON.stringify([owner.projectId, owner.extensionId])}`;
export const automationPrincipalRef = (principal: Pick<AutomationPrincipal, "id" | "created_by">) =>
  `${principal.created_by === "extension" ? "extension" : "token"}:${principal.id}`;
export const automationRunRecord = <T extends { principal: string }>(row: T) => {
  const { principal, ...rest } = row;
  return { ...rest, principal_id: principal.slice(principal.indexOf(":") + 1) };
};
const extensionOwnerWhere = (projectId: string, extensionId?: string) =>
  and(
    eq(preferences.scope, "project"),
    eq(preferences.scope_id, projectId),
    eq(preferences.project_id, projectId),
    sql`starts_with(${preferences.key}, ${ownerKey})`,
    extensionId ? eq(preferences.extension_id, extensionId) : undefined,
  );
export const getExtensionAutomationOwners = async (
  db: AutomationOwnerClient,
  owner: { projectId: string; extensionId: string },
) => {
  const rows = await db
    .select()
    .from(preferences)
    .where(extensionOwnerWhere(owner.projectId, owner.extensionId))
    .orderBy(preferences.updated_at, preferences.key);
  return rows.map((row) => ({ ...(row.value as AutomationPrincipal), name: row.extension_id }));
};
export const getExtensionAutomationOwner = async (
  db: AutomationOwnerClient,
  owner: { projectId: string; extensionId: string },
) => {
  const rows = await getExtensionAutomationOwners(db, owner);
  return rows.find((row) => row.id === extensionPrincipalId(owner)) ?? rows[0] ?? null;
};
export const storeExtensionAutomationOwner = async (db: AutomationOwnerClient, principal: AutomationPrincipal) => {
  await db
    .insert(preferences)
    .values({
      scope: "project",
      scope_id: principal.project_id,
      project_id: principal.project_id,
      extension_id: principal.name,
      key: `${ownerKey}${principal.id}`,
      sync: "device",
      value: principal,
      updated_at: principal.created_at,
    })
    .onConflictDoNothing();
};
export const disabledAutomationOwner = async (db: AutomationOwnerClient, projectId: string, id: string) => {
  const [row] = await db
    .select()
    .from(preferences)
    .where(
      and(
        eq(preferences.scope, "project"),
        eq(preferences.scope_id, projectId),
        eq(preferences.extension_id, ""),
        eq(preferences.key, disabledKey(id)),
      ),
    );
  return (row?.value as { disabled_at: string } | undefined)?.disabled_at ?? null;
};
export const storeDisabledAutomationOwner = async (db: AutomationOwnerClient, principal: AutomationPrincipal) => {
  if (!principal.disabled_at) return;
  await db
    .insert(preferences)
    .values({
      scope: "project",
      scope_id: principal.project_id,
      project_id: principal.project_id,
      extension_id: "",
      key: disabledKey(principal.id),
      sync: "device",
      value: { disabled_at: principal.disabled_at },
      updated_at: principal.disabled_at,
    })
    .onConflictDoNothing();
};
export const automationTokenOwner = (
  token: typeof automation_tokens.$inferSelect,
  disabledAt: string | null,
): AutomationPrincipal => ({
  id: token.principal_id,
  project_id: token.project_id,
  name: token.name,
  created_by: token.created_by,
  created_at: token.principal_created_at,
  disabled_at: disabledAt,
});
export const getAutomationOwner = async (db: AutomationOwnerClient, projectId: string, id: string) => {
  const [extension] = await db
    .select()
    .from(preferences)
    .where(and(extensionOwnerWhere(projectId), sql`${preferences.value}->>'id' = ${id}`))
    .limit(1);
  if (extension) return { ...(extension.value as AutomationPrincipal), name: extension.extension_id };
  const [token] = await db
    .select()
    .from(automation_tokens)
    .where(and(eq(automation_tokens.project_id, projectId), eq(automation_tokens.principal_id, id)))
    .limit(1);
  return token ? automationTokenOwner(token, await disabledAutomationOwner(db, projectId, id)) : null;
};
