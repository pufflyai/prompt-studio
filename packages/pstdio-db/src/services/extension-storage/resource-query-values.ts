import { and, eq, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import type { DbClient } from "../../db/connection.pglite";
import { owners } from "../../db/schemas.pg";
import { jsonBatches } from "./json-batches";
import { recordIndexRows as indexes, saveRecordIndexRow } from "./record-index-rows";
import { encodeProjectionValue } from "./record-projection-codec";
import { storageOwnerKey } from "./storage-owner-key";

export const identityQueryKey = "@pstdio/identity-query-v1";
// Revisit missing metadata left by ordered identities allocated after the v1 backfill.
export const identityQueryVersion = "v2";
const marker = `@pstdio/query-format/${JSON.stringify(["@core-identities", identityQueryVersion, "0"])}`;
type Transaction = Pick<DbClient, "execute" | "select" | "insert">;

export const writeResourceQueryValues = async (
  tx: Transaction,
  projectId: string,
  rows: { id: string; shorthand: string; aliases: string[] }[],
) => {
  for (const input of jsonBatches(
    rows.map(({ id, shorthand, aliases }) => ({
      id,
      fields: encodeProjectionValue({ [identityQueryKey]: { shorthand, aliases: [...new Set(aliases)].sort() } }),
    })),
  ))
    await tx.execute(sql`UPDATE storage_current_records AS target SET query_values = target.query_values || input.fields
      FROM jsonb_to_recordset(${input}::jsonb) AS input(id text, fields jsonb)
      WHERE target.owner_id = ${storageOwnerKey({ workbenchId: projectId, extensionId: "pstdio" })} AND target.record_id = input.id`);
};

/** Ordered number arbitration runs before the current record is published. Refresh only its touched identities afterward. */
export const refreshResourceQueryValues = async (tx: Transaction, owner: StorageOwner, ids: string[]) => {
  if (owner.extensionId !== "pstdio") return;
  for (let offset = 0; offset < ids.length; offset += 100) {
    const selected = ids.slice(offset, offset + 100);
    const result = await tx.execute<{ id: string; shorthand: string; aliases: string[] }>(sql`
      SELECT identity.resource_id AS id, identity.shorthand,
        coalesce((SELECT jsonb_agg(alias.shorthand ORDER BY alias.shorthand COLLATE "C") FROM storage_resource_aliases alias
          WHERE alias.workbench_id = identity.workbench_id AND alias.resource_id = identity.resource_id), '[]'::jsonb) AS aliases
      FROM storage_resource_identities identity
      WHERE identity.workbench_id = ${owner.workbenchId} AND identity.resource_id IN (${sql.join(
        selected.map((id) => sql`${id}`),
        sql`, `,
      )})`);
    await writeResourceQueryValues(tx, owner.workbenchId, result.rows);
  }
};

/** Upgrade local query metadata in bounded identity/alias pages, without loading core documents. */
export const prepareResourceQueryValues = async (tx: Transaction, owner: StorageOwner) => {
  const [core] = await tx
    .select({ id: owners.id })
    .from(owners)
    .where(eq(owners.id, storageOwnerKey({ ...owner, extensionId: "pstdio" })));
  if (!core) return;
  const where = and(
    eq(indexes.owner_id, storageOwnerKey({ ...owner, extensionId: "pstdio" })),
    eq(indexes.name, marker),
  );
  if ((await tx.select({ name: indexes.name }).from(indexes).where(where)).length) return;
  for (;;) {
    const result = await tx.execute<{ id: string; shorthand: string; aliases: string[] }>(sql`
      SELECT identity.resource_id AS id, identity.shorthand,
        coalesce((SELECT jsonb_agg(alias.shorthand ORDER BY alias.shorthand COLLATE "C") FROM storage_resource_aliases alias
          WHERE alias.workbench_id = identity.workbench_id AND alias.resource_id = identity.resource_id), '[]'::jsonb) AS aliases
      FROM storage_resource_identities identity INNER JOIN storage_current_records source
        ON source.owner_id = ${storageOwnerKey({ ...owner, extensionId: "pstdio" })} AND source.record_id = identity.resource_id
      WHERE identity.workbench_id = ${owner.workbenchId} AND NOT source.query_values ? ${identityQueryKey}
      ORDER BY identity.resource_id COLLATE "C" LIMIT 100`);
    if (!result.rows.length) break;
    await writeResourceQueryValues(tx, owner.workbenchId, result.rows);
  }
  await saveRecordIndexRow(tx, {
    owner_id: storageOwnerKey({ ...owner, extensionId: "pstdio" }),
    name: marker,
    database_name: "storage_format_identity_v1",
    definition: { name: marker, fields: { shorthand: { path: ["prefix"], type: "string" } } },
  });
};
