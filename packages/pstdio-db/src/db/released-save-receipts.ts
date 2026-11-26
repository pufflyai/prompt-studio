import { type SQL, sql } from "drizzle-orm";
import { type OrderedAdmission, type OrderedOperation, operationDependencies } from "pstdio-sync/records";
import { decodeOrderedJson } from "../services/extension-storage/ordered-sql";
import type { DbClient } from "./connection.pglite";
import { hasUpgradeSnapshots, prepareUpgradeSnapshot } from "./upgrade-snapshot";

const queueSnapshot = "ordered-queue-dependencies";
type Row = Record<string, unknown>;
type QueueEntry = { workbench_id: string; extension_id: string; ids: string[]; opaque: boolean };

const queueEntry = async (row: Row): Promise<QueueEntry> => {
  const ids = new Set([String(row.operation_id)]);
  let opaque = false;
  try {
    if (row.envelope) {
      const operation = decodeOrderedJson<OrderedOperation>(row.envelope as Uint8Array);
      for (const id of operationDependencies(operation).keys()) ids.add(id);
    }
    if (row.admission) {
      const admission = decodeOrderedJson<OrderedAdmission>(row.admission as Uint8Array);
      for (const dependency of admission.dependencies) ids.add(dependency.operationId);
    }
  } catch {
    // An unreadable queued envelope may refer to any earlier decision in its own stream.
    opaque = true;
  }
  return { workbench_id: String(row.workbench_id), extension_id: String(row.extension_id), ids: [...ids], opaque };
};
export type ReleasedSaveReceipts = {
  operations: SQL;
  documents: SQL;
  expireDocumentRetries: boolean;
  owners: SQL;
  complete: () => Promise<void>;
};

/** The legacy layout change expires old save IDs. Preserve the evidence a queued save may need
 * to resolve its dependencies and recover its delivery outcome after reconnecting. */
export const prepareReleasedSaveReceipts = async (
  db: DbClient,
  path: string,
  localUpgrade = false,
): Promise<ReleasedSaveReceipts | undefined> => {
  const {
    rows: [schema],
  } = await db.execute<{ released: boolean }>(sql`SELECT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public'
    AND table_name='storage_ordered_operations' AND column_name='workbench_id') AS released`);
  // Capture just the live queue's references before any group can clear its source.
  // If an older build already staged recovery inputs, finish those under their original rules.
  let hasQueuedSaves = false;
  const pending: QueueEntry[] = [];
  const flush = async () => {
    if (!pending.length) return;
    const entries = JSON.stringify(pending.splice(0));
    await db.execute(sql`INSERT INTO upgrade_pending_owners SELECT workbench_id,extension_id,bool_or(opaque)
      FROM jsonb_to_recordset(${entries}::jsonb) o(workbench_id text,extension_id text,opaque boolean)
      GROUP BY workbench_id,extension_id ON CONFLICT (workbench_id,extension_id) DO UPDATE SET opaque=upgrade_pending_owners.opaque OR excluded.opaque`);
    await db.execute(sql`INSERT INTO upgrade_needed_operations SELECT workbench_id,extension_id,id
      FROM jsonb_to_recordset(${entries}::jsonb) o(workbench_id text,extension_id text,ids jsonb)
      CROSS JOIN LATERAL jsonb_array_elements_text(o.ids) AS ids(id) ON CONFLICT DO NOTHING`);
  };
  const queue = await prepareUpgradeSnapshot(
    db,
    path,
    {
      name: queueSnapshot,
      table: "storage_ordered_operations",
      keys: ["workbench_id", "extension_id", "operation_id"],
      where: sql`settled_epoch IS NULL AND (envelope IS NOT NULL OR admission IS NOT NULL)`,
      capture: schema?.released && !(await hasUpgradeSnapshots(path, queueSnapshot)),
      keepEmpty: true,
    },
    async (row) => {
      hasQueuedSaves = true;
      pending.push(row as QueueEntry);
      if (pending.length === 200) await flush();
    },
    queueEntry,
  );
  if (!queue) return;
  await db.execute(sql`CREATE TEMP TABLE upgrade_pending_owners (workbench_id text, extension_id text,
      opaque boolean NOT NULL, PRIMARY KEY (workbench_id,extension_id))`);
  await db.execute(sql`CREATE TEMP TABLE upgrade_needed_operations (workbench_id text,extension_id text,
      operation_id text, PRIMARY KEY(workbench_id,extension_id,operation_id))`);
  await queue(true);
  await flush();
  const queued = sql`(workbench_id,extension_id) IN (SELECT workbench_id,extension_id FROM upgrade_pending_owners)`;
  const opaque = sql`(workbench_id,extension_id) IN (SELECT workbench_id,extension_id FROM upgrade_pending_owners WHERE opaque)`;
  // Document operation rows only bind prior save IDs to fingerprints. An outstanding
  // edit in either released queue keeps its original retry behavior across conversion.
  const expireDocumentRetries =
    localUpgrade ||
    Boolean(
      schema?.released &&
        !hasQueuedSaves &&
        (
          await db.execute<{ settled: boolean }>(
            sql`SELECT NOT EXISTS (SELECT 1 FROM storage_record_outbox) AS settled`,
          )
        ).rows[0]?.settled,
    );
  return {
    expireDocumentRetries,
    operations: sql`${opaque} OR (workbench_id,extension_id,operation_id) IN
      (SELECT workbench_id,extension_id,operation_id FROM upgrade_needed_operations)`,
    documents: sql`(document_id NOT LIKE '["ordered-dependency",%' OR ${opaque} OR
      (workbench_id,extension_id,document_id) IN (SELECT workbench_id,extension_id,'["ordered-dependency",' || to_json(operation_id)::text || ']' FROM upgrade_needed_operations))
      AND (document_id NOT LIKE '["ordered-index-blob",%' OR ${queued})`,
    owners: sql`SELECT workbench_id,extension_id,epoch,joined,"after",state_id,through,pending_bytes,state_bytes,skipped,
      CASE WHEN ${queued} THEN receipt_root END AS receipt_root FROM storage_ordered_owners`,
    complete: async () => {
      await db.execute(sql`DROP TABLE pg_temp.upgrade_needed_operations, pg_temp.upgrade_pending_owners`);
      await queue.complete();
    },
  };
};
