import { sql } from "drizzle-orm";
import {
  type AutomationPrincipal,
  automationPrincipalRef,
  storeDisabledAutomationOwner,
  storeExtensionAutomationOwner,
} from "../services/automation/automation-owners";
import type { DbClient } from "./connection.pglite";
import { automation_runs, automation_tokens } from "./schemas/automation";
import { prepareUpgradeSnapshot } from "./upgrade-snapshot";

const releasedPrincipal = async (db: DbClient, id: unknown, projectId: unknown) => {
  const {
    rows: [principal],
  } = await db.execute<AutomationPrincipal>(sql`SELECT * FROM automation_principals WHERE id = ${id}`);
  if (!principal || principal.project_id !== projectId)
    throw new Error(`Released automation ownership does not match for ${id}`);
  return principal;
};
export const prepareAutomationOwnersUpgrade = async (db: DbClient, path: string) => {
  const owners = await prepareUpgradeSnapshot(
    db,
    path,
    { table: "automation_principals", keys: ["id"], name: "automation-owners" },
    async (row) => {
      const principal = row as AutomationPrincipal;
      if (principal.created_by === "extension") await storeExtensionAutomationOwner(db, principal);
      else await storeDisabledAutomationOwner(db, principal);
    },
  );
  // The source table is the boundary marker. Once the schema migration dropped
  // it, any surviving snapshots already hold normalized rows ready to restore.
  const {
    rows: [legacy],
  } = await db.execute<{ present: string | null }>(
    sql`SELECT to_regclass('public.automation_principals')::text AS present`,
  );
  const tokens = await prepareUpgradeSnapshot(
    db,
    path,
    { table: "automation_tokens", keys: ["id"], name: "automation-tokens", capture: Boolean(legacy.present) },
    async (row) => {
      await db
        .insert(automation_tokens)
        .values(row as typeof automation_tokens.$inferInsert)
        .onConflictDoNothing();
    },
    async (row) => {
      const owner = await releasedPrincipal(db, row.principal_id, row.project_id);
      return {
        ...row,
        name: owner.name,
        created_by: owner.created_by,
        principal_created_at: owner.created_at,
        revoked_at: row.revoked_at ?? owner.disabled_at,
      };
    },
  );
  const runs = await prepareUpgradeSnapshot(
    db,
    path,
    { table: "automation_runs", keys: ["id"], name: "automation-runs", capture: Boolean(legacy.present) },
    async (row) => {
      await db
        .insert(automation_runs)
        .values(row as typeof automation_runs.$inferInsert)
        .onConflictDoNothing();
    },
    async (row) => {
      const owner = await releasedPrincipal(db, row.principal_id, row.project_id);
      if (row.token_id !== null) {
        const {
          rows: [token],
        } = await db.execute<{ principal_id: string; project_id: string }>(
          sql`SELECT principal_id, project_id FROM automation_tokens WHERE id = ${row.token_id}`,
        );
        if (!token || token.principal_id !== row.principal_id || token.project_id !== row.project_id)
          throw new Error(`Released automation run ownership does not match for ${row.id}`);
      }
      const { principal_id, ...run } = row;
      return { ...run, principal: automationPrincipalRef(owner) };
    },
  );
  if (!legacy.present && !owners && !tokens && !runs) return;
  if (legacy.present)
    await db.transaction(async (tx) => {
      // New required owner columns can be added only after the complete source has
      // been fsynced. Keep all three snapshots until every restored row commits.
      await tx.delete(automation_runs);
      await tx.delete(automation_tokens);
    });
  return async () => {
    await owners?.(true);
    await tokens?.(true);
    await runs?.(true);
    await owners?.complete();
    await tokens?.complete();
    await runs?.complete();
  };
};
