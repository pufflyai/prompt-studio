import { sql } from "drizzle-orm";
import { releasedAutomationOwner, releasedTokenOwnerPreference } from "../services/automation/automation-owners";
import { restoreAutomationRun } from "./automation-run-upgrade";
import type { DbClient } from "./connection.pglite";
import { automation_runs, automation_tokens } from "./schemas/automation";
import { preferences } from "./schemas/preferences";
import { prepareUpgradeSnapshot } from "./upgrade-snapshot";

type ReleasedPrincipal = {
  id: string;
  project_id: string;
  name: string;
  created_by: string;
  created_at: string;
  disabled_at: string | null;
};
const releasedPrincipal = async (db: DbClient, id: unknown, projectId: unknown) => {
  const {
    rows: [principal],
  } = await db.execute<ReleasedPrincipal>(sql`SELECT * FROM automation_principals WHERE id = ${id}`);
  if (!principal || principal.project_id !== projectId)
    throw new Error(`Released automation ownership does not match for ${id}`);
  return principal;
};
export const restoreAutomationPolicy = async (db: DbClient, principal: ReleasedPrincipal) => {
  if (principal.created_by !== "extension" || !principal.disabled_at) return;
  await db
    .insert(preferences)
    .values({
      scope: "project",
      scope_id: principal.project_id,
      project_id: principal.project_id,
      extension_id: principal.name,
      key: "automation-disabled",
      sync: "device",
      value: principal.disabled_at,
      updated_at: principal.disabled_at,
    })
    .onConflictDoNothing();
};
export const prepareAutomationOwnersUpgrade = async (db: DbClient, path: string) => {
  const owners = await prepareUpgradeSnapshot(
    db,
    path,
    { table: "automation_principals", keys: ["id"], name: "automation-owners" },
    (row) => restoreAutomationPolicy(db, row as ReleasedPrincipal),
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
      const { released_principal_id, ...values } = row;
      const token = values as typeof automation_tokens.$inferInsert;
      await db.transaction(async (tx) => {
        await tx.insert(automation_tokens).values(token).onConflictDoNothing();
        if (typeof released_principal_id === "string")
          await tx
            .insert(preferences)
            .values(releasedTokenOwnerPreference(token, released_principal_id))
            .onConflictDoNothing();
      });
    },
    async (row) => {
      const owner = await releasedPrincipal(db, row.principal_id, row.project_id);
      const { principal_id, ...token } = row;
      return {
        ...token,
        name: owner.name,
        created_by: owner.created_by,
        revoked_at: row.revoked_at ?? owner.disabled_at,
        released_principal_id: owner.id,
      };
    },
  );
  const runs = await prepareUpgradeSnapshot(
    db,
    path,
    { table: "automation_runs", keys: ["id"], name: "automation-runs", capture: Boolean(legacy.present) },
    (row) => restoreAutomationRun(db, path, row),
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
      } else if (owner.created_by !== "extension") {
        throw new Error(`Released automation run ownership does not match for ${row.id}`);
      }
      const { principal_id, ...run } = row;
      return {
        ...run,
        principal: row.token_id !== null ? releasedAutomationOwner(owner.id) : `extension:${owner.name}`,
        released_principal_id: owner.id,
      };
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
