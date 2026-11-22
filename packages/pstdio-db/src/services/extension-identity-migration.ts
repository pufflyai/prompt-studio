import { type SQLWrapper, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import {
  canonicalExtensionId,
  type ExtensionIdentityRename,
  extensionIdentityRenames,
} from "pstdio-api-contracts/extension-host";
import * as Y from "yjs";
import type { DbClient } from "../db/connection.pglite";
import * as s from "../db/schemas.pg";
import { unadmittedExtensionProjects, unadmittedStorageOwners } from "../db/storage-admission";
import { availableIdentityProject, mergeTextOwnerHistories, textOnlyOwnerSql } from "./extension-identity-storage";
import { indexNodeFilesFor } from "./extension-storage/index-node-files";
import { ensureStorageOwner } from "./extension-storage/storage-owner-key";

const projectTables = [s.storage_ordered_resource_numbers];
const otherTables = [
  s.owners,
  s.board_views,
  s.preferences,
  s.credentials,
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

const projectColumn = (table: (typeof projectTables)[number] | (typeof otherTables)[number]) =>
  "workbench_id" in table ? table.workbench_id : table.project_id;
const assertNoConflicts = async (tx: Transaction, from: string, to: string, excluded: readonly string[]) => {
  // Each text file has its own document, updates and retry journal. Separate file IDs can
  // retain both histories byte for byte. Ordered streams and shared document IDs cannot.
  const documents = new Set<PgTable>([s.storage_documents, s.storage_document_updates, s.storage_document_operations]);
  const owners = sql.join(
    [
      ...projectTables.map((table) => {
        const textFile = documents.has(table) ? sql`starts_with(document_id, '["text-file",')` : sql`false`;
        return sql`SELECT workbench_id AS scope, extension_id, ${textFile} AS text_file FROM ${table}
        WHERE ${ownerColumn} IN (${from}, ${to})`;
      }),
      sql`SELECT o.project_id AS scope, o.extension_id, ${textOnlyOwnerSql("o")} AS text_file FROM ${s.owners} o WHERE o.extension_id IN (${from}, ${to})`,
      sql`SELECT o.project_id AS scope,o.extension_id,starts_with(d.document_id, '["text-file",') AS text_file
        FROM storage_documents d JOIN owners o ON d.owner_id=o.id WHERE o.extension_id IN (${from},${to})`,
    ],
    sql` UNION ALL `,
  );
  const scopes =
    await tx.execute(sql`SELECT scope FROM (${owners}) owners WHERE ${availableIdentityProject(sql`scope`, excluded)} GROUP BY scope
    HAVING count(DISTINCT extension_id) > 1 AND (
      (bool_or(NOT text_file AND extension_id = ${from}) AND bool_or(NOT text_file AND extension_id = ${to}))
      OR EXISTS (SELECT 1 FROM storage_documents a JOIN owners ao ON a.owner_id=ao.id
        JOIN owners bo ON bo.project_id=ao.project_id JOIN storage_documents b ON b.owner_id=bo.id AND b.document_id=a.document_id
        WHERE ao.project_id=owners.scope AND ao.extension_id=${from} AND bo.extension_id=${to})
      OR EXISTS (SELECT 1 FROM owners a JOIN owners b USING(project_id)
        WHERE a.project_id=owners.scope AND a.extension_id=${from} AND b.extension_id=${to}
          AND NOT (${textOnlyOwnerSql("a")} AND ${textOnlyOwnerSql("b")}))
    ) LIMIT 1`);
  if (scopes.rows[0]) throw new ExtensionIdentityConflictError(from, to, String(scopes.rows[0].scope));
  for (const [table, scope] of [
    [
      s.preferences,
      sql`jsonb_build_array(scope,
      CASE WHEN scope = 'user' AND scope_id = ${from} AND starts_with(key, 'setting:')
        THEN ${to} ELSE scope_id END)`,
    ],
    [s.credentials, sql`jsonb_build_array(project_id, contribution_id)`],
    [s.board_views, sql`jsonb_build_array(project_id, board_id)`],
    [s.extension_resource_sequences, sql`to_jsonb(project_id)`],
    [s.storage_resource_identities, sql`to_jsonb(workbench_id)`],
  ] as const) {
    const result = await tx.execute(sql`SELECT ${scope} AS scope FROM ${table} WHERE ${ownerColumn} IN (${from}, ${to})
      AND ${availableIdentityProject(projectColumn(table), excluded)} GROUP BY 1 HAVING count(DISTINCT extension_id) > 1 LIMIT 1`);
    if (result.rows[0]) throw new ExtensionIdentityConflictError(from, to, JSON.stringify(result.rows[0].scope));
  }
  const runs = await tx.execute(sql`SELECT project_id AS scope FROM ${s.automation_runs}
    WHERE principal IN (${`extension:${from}`}, ${`extension:${to}`})
    AND ${availableIdentityProject(s.automation_runs.project_id, excluded)} GROUP BY project_id
    HAVING count(DISTINCT principal) > 1 LIMIT 1`);
  if (runs.rows[0]) throw new ExtensionIdentityConflictError(from, to, String(runs.rows[0].scope));
};

/** Startup and runtime source recovery move each owner in one transaction. */
export const migrateExtensionIdentities = async (
  db: DbClient,
  options: {
    extensionId?: string;
    onRenamed?: (change: { from: string; to: string }) => Promise<void>;
    onConflict?: (error: ExtensionIdentityConflictError) => Promise<void>;
    /** Runs once before the first rename commits, so space reclamation is recorded as owed first. */
    beforeChange?: () => Promise<void>;
  } = {},
) => {
  const renames = extensionIdentityRenames.filter(
    ({ from, to }) =>
      !options.extensionId ||
      [`${from.publisher}.${from.name}`, `${to.publisher}.${to.name}`].includes(options.extensionId),
  );
  if (!renames.length) return false;
  const projects = await db.execute(sql`SELECT id FROM ${s.projects} p WHERE NOT EXISTS
    (SELECT 1 FROM ${s.storage_documents} d JOIN owners o ON d.owner_id=o.id WHERE o.project_id = p.id AND o.extension_id = 'pstdio' AND d.document_id = ${markerId})`);
  const pending = projects.rows.map((row) => String(row.id));
  const oldIds = renames.map(({ from }) => `${from.publisher}.${from.name}`);
  const blocked = unadmittedStorageOwners(db).flatMap((owner) =>
    oldIds
      .filter((id) => canonicalExtensionId(id) === canonicalExtensionId(owner.extensionId))
      .map((extensionId) => ({ ...owner, extensionId })),
  );
  const availableSource = (project: SQLWrapper, extension: SQLWrapper) =>
    blocked.length
      ? sql`(${project} IS NULL OR NOT (${sql.join(
          blocked.map((owner) => sql`(${project}=${owner.workbenchId} AND ${extension}=${owner.extensionId})`),
          sql` OR `,
        )}))`
      : sql`true`;

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
            )}) AND ${availableSource(table.workbench_id, ownerColumn)} AND ${ownerColumn} IN (${sql.join(
              oldIds.map((id) => sql`${id}`),
              sql`, `,
            )})`,
        ),
        ...otherTables.map(
          (table) => sql`SELECT extension_id FROM ${table}
            WHERE ${availableSource(projectColumn(table), ownerColumn)} AND ${ownerColumn} IN (${oldOwners})`,
        ),
        sql`SELECT extension_id FROM ${s.installed_extension_sources} WHERE ${ownerColumn} IN (${oldOwners})`,
        sql`SELECT source_extension_id AS extension_id FROM ${s.notifications} WHERE ${availableSource(s.notifications.project_id, s.notifications.source_extension_id)} AND source_extension_id IN (${sql.join(
          oldIds.map((id) => sql`${id}`),
          sql`, `,
        )})`,
        sql`SELECT owner AS extension_id FROM ${s.files} WHERE ${availableSource(s.files.project_id, s.files.owner)} AND owner IN (${oldOwners})`,
        sql`SELECT name AS extension_id FROM ${s.automation_tokens} WHERE created_by = 'extension' AND ${availableSource(s.automation_tokens.project_id, s.automation_tokens.name)} AND name IN (${oldOwners})`,
        sql`SELECT substring(principal from 11) AS extension_id FROM ${s.automation_runs}
          WHERE ${availableSource(s.automation_runs.project_id, sql`substring(principal from 11)`)} AND principal IN (${sql.join(
            oldIds.map((id) => sql`${`extension:${id}`}`),
            sql`, `,
          )})`,
      ],
      sql` UNION ALL `,
    )}) candidates`,
  );
  const presentOwners = new Set(candidates.rows.map((row) => String(row.extension_id)));
  const gated = await db.execute(sql`SELECT extension_id FROM ${s.installed_extension_sources}
    WHERE last_error_json->>'code' = 'extension_identity_conflict'`);
  const gatedOwners = new Set(gated.rows.map((row) => String(row.extension_id)));
  let conflicted = false;
  let renamed = false;
  for (const { from: previous, to: canonical } of renames) {
    const from = `${previous.publisher}.${previous.name}`;
    const to = `${canonical.publisher}.${canonical.name}`;
    const excluded = unadmittedExtensionProjects(db, from);
    if (excluded.length) conflicted = true;
    if (!presentOwners.has(from) && !gatedOwners.has(from) && !gatedOwners.has(to)) continue;
    try {
      if (!renamed) await options.beforeChange?.();
      await db.transaction(async (tx) => {
        await assertNoConflicts(tx, from, to, excluded);
        await mergeTextOwnerHistories(tx, from, to, excluded);
        for (const table of [...projectTables, ...otherTables])
          await tx.execute(sql`UPDATE ${table} SET ${ownerColumn} = ${to} WHERE ${ownerColumn} = ${from}
            AND ${availableIdentityProject(projectColumn(table), excluded)}`);
        await tx.execute(sql`UPDATE ${s.files} SET owner = ${to} WHERE owner = ${from}
          AND ${availableIdentityProject(s.files.project_id, excluded)}`);
        // Device settings use the stable extension identity as their local owner key too.
        await tx.execute(sql`UPDATE ${s.preferences} SET scope_id = ${to}
          WHERE extension_id = ${to} AND scope = 'user' AND scope_id = ${from} AND starts_with(key, 'setting:')`);
        await tx.execute(sql`UPDATE ${s.installed_extension_sources} SET extension_id = ${to},
        install_name = CASE WHEN install_name IN (${previous.name}, ${from}, ${canonical.name}, ${to}) THEN ${canonical.name} ELSE install_name END,
        manifest_json = CASE WHEN manifest_json->>'name' = ${previous.name} THEN jsonb_set(manifest_json, '{name}', to_jsonb(${canonical.name}::text)) ELSE manifest_json END WHERE extension_id = ${from}`);
        await tx.execute(
          sql`UPDATE ${s.notifications} SET source_extension_id = ${to} WHERE source_extension_id = ${from}
            AND ${availableIdentityProject(s.notifications.project_id, excluded)}`,
        );
        // Extension references follow the owner; user-created token names are prose.
        await tx.execute(sql`UPDATE ${s.automation_runs} SET principal = ${`extension:${to}`}
          WHERE principal = ${`extension:${from}`} AND ${availableIdentityProject(s.automation_runs.project_id, excluded)}`);
        await tx.execute(
          sql`UPDATE ${s.automation_tokens} SET name = ${to} WHERE created_by = 'extension' AND name = ${from}
            AND ${availableIdentityProject(s.automation_tokens.project_id, excluded)}`,
        );
        await tx.execute(sql`UPDATE ${s.installed_extension_sources} SET status = 'pending', last_error_json = NULL
        WHERE extension_id = ${to} AND last_error_json->>'code' = 'extension_identity_conflict'`);
      });
      renamed = true;
      await options.onRenamed?.({ from, to });
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
      .values(
        await Promise.all(
          pending.map(async (workbenchId) => ({
            owner_id: await ensureStorageOwner(db, { workbenchId, extensionId: "pstdio" }),
            document_id: markerId,
            state,
          })),
        ),
      )
      .onConflictDoNothing();
  }
  await moveRenamedIndexNodes(db, renames);
  return renamed;
};

/**
 * Index node files follow their rows. This also runs when no rows moved now, so files left under an
 * old id by a crash after an earlier rename committed still move. A refused rename keeps its rows,
 * and therefore its files, under the old id.
 */
const moveRenamedIndexNodes = async (db: DbClient, renames: readonly ExtensionIdentityRename[]) => {
  const files = indexNodeFilesFor(db);
  for (const { from: previous, to: canonical } of renames) {
    const from = `${previous.publisher}.${previous.name}`;
    if (!(await files.hasExtension(from))) continue;
    const remaining = await db.execute(sql`SELECT project_id FROM ${s.owners} o WHERE o.extension_id = ${from}`);
    await files.moveExtension(
      from,
      `${canonical.publisher}.${canonical.name}`,
      new Set(remaining.rows.map((row) => String(row.project_id))),
    );
  }
};
