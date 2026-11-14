import { getTableColumns, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { extensionIdentityRenames } from "pstdio-api-contracts/extension-host";
import * as Y from "yjs";
import type { DbClient } from "../db/connection.pglite";
import * as s from "../db/schemas.pg";

// Ordered by foreign-key dependency. Only these composite-key parents need a new key before moving children.
const parents = [
  s.storage_documents,
  s.storage_record_projections,
  s.storage_ordered_owners,
  s.storage_ordered_operations,
  s.storage_record_sync,
  s.storage_log_streams,
  s.native_document_sources,
];
const projectTables = [
  ...parents,
  s.storage_document_updates,
  s.storage_document_operations,
  s.storage_current_records,
  s.storage_record_indexes,
  s.storage_ordered_records,
  s.storage_ordered_touches,
  s.storage_ordered_receipts,
  s.storage_record_outbox,
  s.storage_log_entries,
  s.native_document_file_projections,
  s.native_document_rooms,
  s.storage_personal_history,
  s.storage_personal_history_sources,
  s.storage_personal_history_positions,
  s.storage_ordered_resource_numbers,
  s.recovery_point_owners,
];
const otherTables = [
  s.extension_settings,
  s.webview_preferences,
  s.extension_connections,
  s.assetTransfers,
  s.extension_resource_sequences,
  s.storage_resource_identities,
];
const ownerColumn = sql.identifier("extension_id");
type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
const markerId = '["host-local-migration","first-party-identities-v1"]';

export class ExtensionIdentityConflictError extends Error {
  readonly code = "extension_identity_conflict";
  constructor(
    readonly from: string,
    readonly to: string,
    readonly scope: string,
  ) {
    super(
      `Extension identity conflict in ${scope}: ${from} and ${to} both contain data. Resolve the conflict before activating ${to}.`,
    );
  }
}

const assertNoConflicts = async (tx: Transaction, from: string, to: string) => {
  // Cross-family detection prevents a new document and an old ordered stream becoming one accidental history.
  const owners = sql.join(
    projectTables.map(
      (table) => sql`SELECT workbench_id AS scope, extension_id FROM ${table}
    WHERE ${ownerColumn} IN (${from}, ${to})`,
    ),
    sql` UNION ALL `,
  );
  const scopes = await tx.execute(
    sql`SELECT scope FROM (${owners}) owners GROUP BY scope HAVING count(DISTINCT extension_id) > 1 LIMIT 1`,
  );
  if (scopes.rows[0]) throw new ExtensionIdentityConflictError(from, to, String(scopes.rows[0].scope));
  for (const [table, scope] of [
    [s.extension_settings, sql`jsonb_build_array(owner_type, owner_id)`],
    [s.webview_preferences, sql`jsonb_build_array(scope_type, scope_id)`],
    [s.extension_connections, sql`to_jsonb(project_id)`],
    [s.assetTransfers, sql`to_jsonb(project_id)`],
    [s.extension_resource_sequences, sql`to_jsonb(project_id)`],
    [s.storage_resource_identities, sql`to_jsonb(workbench_id)`],
  ] as const) {
    const result = await tx.execute(sql`SELECT ${scope} AS scope FROM ${table} WHERE ${ownerColumn} IN (${from}, ${to})
      GROUP BY ${scope} HAVING count(DISTINCT extension_id) > 1 LIMIT 1`);
    if (result.rows[0]) throw new ExtensionIdentityConflictError(from, to, JSON.stringify(result.rows[0].scope));
  }
  const anchors = await tx.execute(sql`SELECT project_id AS scope FROM ${s.resource_anchors}
    WHERE source_owner IN (${from}, ${to}) OR target_owner IN (${from}, ${to})
    GROUP BY project_id HAVING bool_or(source_owner = ${from} OR target_owner = ${from})
      AND bool_or(source_owner = ${to} OR target_owner = ${to}) LIMIT 1`);
  if (anchors.rows[0]) throw new ExtensionIdentityConflictError(from, to, String(anchors.rows[0].scope));
};

const cloneParent = async (tx: Transaction, table: PgTable, from: string, to: string) => {
  const columns = Object.values(getTableColumns(table));
  await tx.execute(sql`INSERT INTO ${table} (${sql.join(
    columns.map((c) => sql.identifier(c.name)),
    sql`, `,
  )})
    SELECT ${sql.join(
      columns.map((c) => (c.name === "extension_id" ? sql`${to}` : sql`${sql.identifier(c.name)}`)),
      sql`, `,
    )}
    FROM ${table} WHERE ${ownerColumn} = ${from}`);
};

/** Startup runs under the database lock, before any extension, writer, relay or projection cache can open. */
export const migrateExtensionIdentities = async (
  db: DbClient,
  options: { extensionId?: string; onConflict?: (error: ExtensionIdentityConflictError) => Promise<void> } = {},
) => {
  const renames = extensionIdentityRenames.filter(
    ({ from, to }) =>
      !options.extensionId ||
      [`${from.publisher}.${from.name}`, `${to.publisher}.${to.name}`].includes(options.extensionId),
  );
  if (!renames.length) return;
  const projects = await db.execute(sql`SELECT id FROM ${s.projects} p WHERE NOT EXISTS
    (SELECT 1 FROM ${s.storage_documents} d WHERE d.workbench_id = p.id AND d.extension_id = 'pstdio' AND d.document_id = ${markerId})`);
  const pending = projects.rows.map((row) => String(row.id));
  const oldIds = renames.map(({ from }) => `${from.publisher}.${from.name}`);
  const oldOwners = sql.join(
    oldIds.map((id) => sql`${id}`),
    sql`, `,
  );
  const candidates = await db.execute(
    sql`SELECT DISTINCT extension_id FROM (${sql.join(
      [
        ...(pending.length ? projectTables : []).map(
          (table) =>
            sql`SELECT extension_id FROM ${table} WHERE workbench_id IN (${sql.join(
              pending.map((id) => sql`${id}`),
              sql`, `,
            )}) AND ${ownerColumn} IN (${sql.join(
              oldIds.map((id) => sql`${id}`),
              sql`, `,
            )})`,
        ),
        ...[...otherTables, s.installed_extension_sources].map(
          (table) =>
            sql`SELECT extension_id FROM ${table} WHERE ${ownerColumn} IN (${sql.join(
              oldIds.map((id) => sql`${id}`),
              sql`, `,
            )})`,
        ),
        sql`SELECT source_extension_id AS extension_id FROM ${s.notifications} WHERE source_extension_id IN (${sql.join(
          oldIds.map((id) => sql`${id}`),
          sql`, `,
        )})`,
        sql`SELECT source_owner AS extension_id FROM ${s.resource_anchors} WHERE source_owner IN (${oldOwners})
          UNION SELECT target_owner FROM ${s.resource_anchors} WHERE target_owner IN (${oldOwners})`,
        sql`SELECT name AS extension_id FROM ${s.automation_principals} WHERE created_by = 'extension' AND name IN (${oldOwners})`,
      ],
      sql` UNION ALL `,
    )}) candidates`,
  );
  const presentOwners = new Set(candidates.rows.map((row) => String(row.extension_id)));
  const gated = await db.execute(sql`SELECT extension_id FROM ${s.installed_extension_sources}
    WHERE last_error_json->>'code' = 'extension_identity_conflict'`);
  const gatedOwners = new Set(gated.rows.map((row) => String(row.extension_id)));
  let conflicted = false;
  for (const { from: previous, to: canonical } of renames) {
    const from = `${previous.publisher}.${previous.name}`;
    const to = `${canonical.publisher}.${canonical.name}`;
    if (!presentOwners.has(from) && !gatedOwners.has(from) && !gatedOwners.has(to)) continue;
    try {
      await db.transaction(async (tx) => {
        await assertNoConflicts(tx, from, to);
        for (const table of parents) await cloneParent(tx, table, from, to);
        for (const table of [
          ...projectTables.filter((t) => !parents.includes(t as (typeof parents)[number])),
          ...otherTables,
        ])
          await tx.execute(sql`UPDATE ${table} SET ${ownerColumn} = ${to} WHERE ${ownerColumn} = ${from}`);
        for (const table of [...parents].reverse())
          await tx.execute(sql`DELETE FROM ${table} WHERE ${ownerColumn} = ${from}`);
        await tx.execute(sql`UPDATE ${s.installed_extension_sources} SET extension_id = ${to},
        install_name = CASE WHEN install_name IN (${previous.name}, ${from}, ${canonical.name}, ${to}) THEN ${canonical.name} ELSE install_name END,
        manifest_json = CASE WHEN manifest_json->>'name' = ${previous.name} THEN jsonb_set(manifest_json, '{name}', to_jsonb(${canonical.name}::text)) ELSE manifest_json END WHERE extension_id = ${from}`);
        await tx.execute(
          sql`UPDATE ${s.notifications} SET source_extension_id = ${to} WHERE source_extension_id = ${from}`,
        );
        for (const column of ["source_owner", "target_owner"])
          await tx.execute(
            sql`UPDATE ${s.resource_anchors} SET ${sql.identifier(column)} = ${to} WHERE ${sql.identifier(column)} = ${from}`,
          );
        // Extension-created principals use their owner as their name; user-created names are prose.
        await tx.execute(
          sql`UPDATE ${s.automation_principals} SET name = ${to} WHERE created_by = 'extension' AND name = ${from}`,
        );
        await tx.execute(sql`UPDATE ${s.installed_extension_sources} SET status = 'pending', last_error_json = NULL
        WHERE extension_id = ${to} AND last_error_json->>'code' = 'extension_identity_conflict'`);
      });
    } catch (error) {
      if (!(error instanceof ExtensionIdentityConflictError) || !options.onConflict) throw error;
      conflicted = true;
      await options.onConflict(error);
    }
  }
  if (!conflicted && !options.extensionId && pending.length) {
    // This device-local marker never enters the owner's encrypted directory or another computer's migration state.
    const document = new Y.Doc();
    document.getMap("data-migrations").set("first-party-identities", 1);
    const state = Y.encodeStateAsUpdate(document);
    document.destroy();
    await db
      .insert(s.storage_documents)
      .values(pending.map((workbench_id) => ({ workbench_id, extension_id: "pstdio", document_id: markerId, state })))
      .onConflictDoNothing();
  }
};
