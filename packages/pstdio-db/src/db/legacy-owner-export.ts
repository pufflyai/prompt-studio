import { randomUUID } from "node:crypto";
import { mkdir, open, rename, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import { coreOwnerId } from "pstdio-sync/records";
import type { DbClient } from "./connection.pglite";
import { flushDirectory } from "./pglite-home-recovery";
import { readUpgradeRows, type UpgradeSource } from "./upgrade-rows";

const ownerSources = (owner: StorageOwner, id: number): UpgradeSource[] => {
  const where = sql`owner_id=${id}`;
  const pair = sql`workbench_id=${owner.workbenchId} AND extension_id=${owner.extensionId}`;
  const numbers = sql`project_id=${owner.workbenchId} AND ${owner.extensionId === coreOwnerId}`;
  return [
    { table: "owners", keys: ["id"], where: sql`id=${id}` },
    { table: "storage_documents", keys: ["owner_id", "document_id"], where },
    { table: "storage_document_updates", keys: ["owner_id", "document_id", "revision"], where },
    { table: "storage_document_operations", keys: ["owner_id", "document_id", "operation_id"], where },
    { table: "storage_current_records", keys: ["owner_id", "record_id"], where },
    { table: "storage_record_sync", keys: ["workbench_id", "extension_id"], where: pair },
    { table: "storage_record_outbox", keys: ["sequence"], where: pair },
    { table: "storage_ordered_owners", keys: ["workbench_id", "extension_id"], where: pair },
    { table: "storage_ordered_records", keys: ["owner_id", "record_id"], where },
    { table: "storage_ordered_operations", keys: ["owner_id", "operation_id"], where },
    { table: "storage_ordered_touches", keys: ["owner_id", "record_id", "operation_id"], where },
    { table: "storage_ordered_receipts", keys: ["owner_id", "epoch", "operation_id"], where },
    { table: "native_document_sources", keys: ["owner_id", "document_key"], where },
    { table: "native_document_rooms", keys: ["id"], where },
    {
      table: "native_document_room_updates",
      keys: ["room_id", "revision"],
      where: sql`room_id IN (SELECT id FROM native_document_rooms WHERE owner_id=${id})`,
    },
    { table: "native_document_file_projections", keys: ["owner_id", "document_key", "projection_key"], where },
    { table: "resource_numbers", keys: ["project_id", "shorthand", "resource_id"], where: numbers },
  ];
};
const segment = (value: string) => encodeURIComponent(value).replace(/^\.+$/u, (dots) => dots.replaceAll(".", "%2E"));

// Match PostgreSQL bytea and decimal bigint exports; user JSON remains unchanged.
const exportRow = (row: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(row).map(([key, value]) => {
      if (typeof value === "bigint") return [key, value.toString()];
      if (value instanceof Uint8Array) return [key, `\\x${Buffer.from(value).toString("hex")}`];
      return [key, value];
    }),
  );

/** Preserve authoritative legacy documents and frames plus any partially converted state. */
export const exportUnconvertedOwner = async (db: DbClient, database: string, owner: StorageOwner, id: number) => {
  if (database === ":memory:") throw new Error("Cannot empty unconverted records without durable file storage");
  const root = join(dirname(database), "backups");
  const run = join(root, `${new Date().toISOString().replaceAll(":", "-")}-${randomUUID()}-unconverted`);
  const folder = join(run, segment(owner.workbenchId));
  await mkdir(folder, { recursive: true, mode: 0o700 });
  for (const parent of [dirname(root), root, run, folder]) await flushDirectory(parent);
  const path = join(folder, `${segment(owner.extensionId)}.json`);
  const temporary = `${path}.partial`;
  const file = await open(temporary, "wx", 0o600);
  try {
    await file.writeFile(
      `{"format":1,"database":${JSON.stringify(database)},"owner":${JSON.stringify(owner)},"tables":{`,
    );
    let firstTable = true;
    const { rows: available } = await db.execute<{ name: string }>(
      sql`SELECT tablename AS name FROM pg_tables WHERE schemaname='public'`,
    );
    const tables = new Set(available.map((row) => row.name));
    for (const source of ownerSources(owner, id).filter((source) => tables.has(source.table))) {
      await file.writeFile(`${firstTable ? "" : ","}${JSON.stringify(source.table)}:[`);
      firstTable = false;
      let firstRow = true;
      for await (const row of readUpgradeRows(db, source)) {
        await file.writeFile(`${firstRow ? "" : ","}${JSON.stringify(exportRow(row))}`);
        firstRow = false;
      }
      await file.writeFile("]");
    }
    await file.writeFile("}}\n");
    await file.sync();
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  } finally {
    await file.close();
  }
  await rename(temporary, path);
  await flushDirectory(folder);
  return path;
};
