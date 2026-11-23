import { isDeepStrictEqual } from "node:util";
import { sql } from "drizzle-orm";
import type { DbClient } from "./connection.pglite";
import { timestampToIso } from "./schemas/iso-timestamp";
import { project_extensions } from "./schemas.pg";
import { prepareUpgradeSnapshot } from "./upgrade-snapshot";

type Legacy = {
  id: string;
  installed_extension_id: string;
  scope_type: string;
  scope_id: string;
  display_name_override: string | null;
  enabled: boolean;
  config_json: (typeof project_extensions.$inferSelect)["config_json"];
  diagnostics_json: (typeof project_extensions.$inferSelect)["diagnostics_json"];
  created_at: string;
  updated_at: string;
};
type Target = typeof project_extensions.$inferSelect;
type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
const batchBytes = 4 * 1024 * 1024;
const conflict = () => new Error("Project extension restoration conflicts with existing configuration.");
const key = (row: Pick<Target, "project_id" | "extension_ref">) => JSON.stringify([row.project_id, row.extension_ref]);
const targetScope = (rows: Target[]) => sql`(${project_extensions.project_id},${project_extensions.extension_ref}) IN
  (SELECT project_id,extension_ref FROM jsonb_to_recordset(${JSON.stringify(
    rows.map(({ project_id, extension_ref }) => ({ project_id, extension_ref })),
  )}::jsonb) AS input(project_id text,extension_ref text))`;
const restoreTargetGroup = async (tx: Transaction, group: Target[]) => {
  const existing = await tx.select().from(project_extensions).where(targetScope(group));
  const retained = new Map(existing.map((row) => [key(row), row]));
  const missing = [];
  for (const row of group) {
    const previous = retained.get(key(row));
    if (previous && !isDeepStrictEqual(previous, row)) throw conflict();
    if (!previous) missing.push(row);
  }
  if (missing.length) await tx.insert(project_extensions).values(missing);
};
const restoreTargets = async (tx: Transaction, inputs: Target[]) => {
  const expected = new Map<string, Target>();
  for (const row of inputs) {
    const previous = expected.get(key(row));
    if (previous && !isDeepStrictEqual(previous, row)) throw conflict();
    expected.set(key(row), row);
  }
  const rows = [...expected.values()];
  // A changed target can be much larger than its released input. Measure first
  // so conflict checks do not hydrate a whole batch of oversized target values.
  const sizes = await tx
    .select({
      project_id: project_extensions.project_id,
      extension_ref: project_extensions.extension_ref,
      bytes: sql<number>`octet_length(row_to_json(${project_extensions})::text)`,
    })
    .from(project_extensions)
    .where(targetScope(rows));
  const targetBytes = new Map(sizes.map((row) => [key(row), row.bytes]));
  for (let start = 0; start < rows.length; ) {
    const group: Target[] = [];
    let bytes = 0;
    while (start < rows.length) {
      const row = rows[start]!;
      const size = Buffer.byteLength(JSON.stringify(row)) + (targetBytes.get(key(row)) ?? 0);
      if (group.length && bytes + size > batchBytes) break;
      group.push(row);
      bytes += size;
      start++;
    }
    await restoreTargetGroup(tx, group);
  }
};
export const prepareProjectExtensionsUpgrade = async (db: DbClient, path: string) => {
  const pending: Target[] = [];
  let bytes = 0;
  const flush = async () => {
    if (!pending.length) return;
    const batch = pending.splice(0);
    bytes = 0;
    await db.transaction((tx) => restoreTargets(tx, batch));
  };
  const restore = await prepareUpgradeSnapshot(
    db,
    path,
    {
      table: "extension_instances",
      keys: ["id"],
      name: "project-extensions",
      archive: "extension-instances",
      select: sql`SELECT i.id,to_jsonb(i) AS released,p.id AS project
        FROM extension_instances i LEFT JOIN projects p
          ON i.scope_type='project' AND p.id=i.scope_id`,
    },
    async (input) => {
      const { released, project } = input as unknown as { released: Legacy; project: string | null };
      // Non-project and orphan scopes have no target in the project-only schema.
      // The exact exported row remains available, including all configuration.
      if (!project) return;
      const expected: Target = {
        project_id: project,
        extension_ref: released.installed_extension_id,
        display_name: released.display_name_override,
        enabled: released.enabled,
        config_json: released.config_json,
        diagnostics_json: released.diagnostics_json,
        created_at: timestampToIso(released.created_at),
        updated_at: timestampToIso(released.updated_at),
      };
      const size = Buffer.byteLength(JSON.stringify(expected));
      if (pending.length && bytes + size > batchBytes) await flush();
      pending.push(expected);
      bytes += size;
      if (pending.length === 200) await flush();
    },
    async (row) => ({ released: row.released, project: row.project }),
  );
  if (!restore) return;
  const finish = async (retain = false) => {
    pending.length = 0;
    bytes = 0;
    try {
      await restore(true);
      await flush();
      if (!retain) await restore.complete();
    } finally {
      pending.length = 0;
      bytes = 0;
    }
  };
  return Object.assign(finish, { complete: restore.complete });
};
