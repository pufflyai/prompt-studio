import { rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { resolvePgliteOptions } from "./connection.pglite";
import { openPglite } from "./open-pglite";
import { prepareReleasedSaveReceipts } from "./released-save-receipts";
import * as schema from "./schemas.pg";
import { cloneClosedDatabase, writeTrialRecords } from "./trial-record-stream";
import { prepareUpgradeSnapshot } from "./upgrade-snapshot";

globalThis.onmessage = async ({ data }) => {
  let db: Awaited<ReturnType<typeof openPglite>> | undefined;
  try {
    const source = `${data.backup}.reader`;
    cloneClosedDatabase(data.backup, source);
    db = await openPglite(source, await resolvePgliteOptions());
    await db.exec(`CREATE SCHEMA upgrade_source; ALTER TABLE storage_ordered_records SET SCHEMA upgrade_source;
      ALTER TABLE storage_current_records SET SCHEMA upgrade_source;
      CREATE TEMP TABLE owners AS SELECT workbench_id AS project_id,extension_id,
      row_number() OVER (ORDER BY workbench_id COLLATE "C",extension_id COLLATE "C")::int AS id FROM storage_ordered_owners`);
    const owners = (
      await db.query(
        'SELECT project_id,extension_id,id FROM owners ORDER BY project_id COLLATE "C",extension_id COLLATE "C"',
      )
    ).rows;
    const client = drizzle(db, { schema });
    await writeTrialRecords(client, join(data.path, "trial-records.copy"));
    globalThis.postMessage({ owners: JSON.stringify(owners) });
    {
      const receipts = await prepareReleasedSaveReceipts(client, source);
      for (const [table, archive, key, where] of [
        [
          "upgrade_source.storage_current_records",
          "storage_current_records",
          ["workbench_id", "extension_id", "record_id"],
        ],
        ["asset_transfers", "asset-transfers", ["project_id", "extension_id", "operation_id"]],
        [
          "storage_documents",
          "storage_documents",
          ["workbench_id", "extension_id", "document_id"],
          receipts?.documents,
        ],
        [
          "storage_document_updates",
          "storage_document_updates",
          ["workbench_id", "extension_id", "document_id", "revision"],
          receipts?.documents,
        ],
        [
          "storage_document_operations",
          "storage_document_operations",
          ["workbench_id", "extension_id", "document_id", "operation_id"],
          receipts?.documents,
        ],
      ] as const) {
        const snapshot = await prepareUpgradeSnapshot(
          client,
          source,
          {
            table: "projects",
            name: archive,
            archive,
            select: sql`SELECT * FROM ${sql.raw(table)}`,
            keys: key,
            where,
            copyJson: true,
          },
          async () => {},
        );
        await snapshot?.complete();
      }
      await receipts?.complete();
      await rename(`${source}-migration-exports`, `${data.path}.verified-exports`);
    }
    await db.close();
    db = undefined;
    await rm(source, { recursive: true });
    globalThis.postMessage({ completed: true });
  } catch (e) {
    globalThis.postMessage({ error: String(e instanceof Error ? e.message : e).slice(0, 120) });
  } finally {
    await db?.close();
    globalThis.close();
  }
};
