import { sql } from "drizzle-orm";
import type { JsonObject } from "pstdio-api-contracts/extension-kernel";
import type { DbClient } from "./connection.pglite";

const qualifiedTable = (name: string) => sql.raw(`"public"."${name.replaceAll('"', '""')}"`);

/** Retain opaque source rows; only the owning extension interprets their format. */
export const archiveRetiredTable = async (db: DbClient, source: string, version: string) => {
  const present = await db.execute(sql`SELECT to_regclass(${`public."${source.replaceAll('"', '""')}"`}) AS name`);
  if (!present.rows[0]?.name) return;
  await db.transaction(async (tx) => {
    const rows = await tx.execute(sql`SELECT to_jsonb(record) AS value FROM ${qualifiedTable(source)} record`);
    if (rows.rows.length === 0) return;
    await tx.execute(sql`CREATE SCHEMA IF NOT EXISTS pstdio_legacy`);
    await tx.execute(sql`CREATE TABLE IF NOT EXISTS pstdio_legacy.snapshots
      (source text PRIMARY KEY, version text NOT NULL, records jsonb NOT NULL)`);
    await tx.execute(sql`INSERT INTO pstdio_legacy.snapshots (source, version, records)
      VALUES (${source}, ${version}, ${JSON.stringify(rows.rows.map((row) => row.value))}::jsonb)
      ON CONFLICT (source) DO UPDATE SET version = EXCLUDED.version, records = EXCLUDED.records`);
  });
};

export const readRetiredData = async (
  db: DbClient,
  source: string,
  scope: { projectId: string; extensionInstanceId: string },
) => {
  const present = await db.execute(sql`SELECT to_regclass('pstdio_legacy.snapshots') AS name`);
  if (!present.rows[0]?.name) return undefined;
  const result = await db.execute(sql`SELECT version, records FROM pstdio_legacy.snapshots WHERE source = ${source}`);
  const snapshot = result.rows[0];
  if (!snapshot) return undefined;
  const records = (snapshot.records as JsonObject[]).filter(
    (record) =>
      record.project_id === scope.projectId &&
      (record.extension_instance_id == null || record.extension_instance_id === scope.extensionInstanceId),
  );
  return { version: String(snapshot.version), records };
};
