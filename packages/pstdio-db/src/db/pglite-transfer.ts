import { createHash } from "node:crypto";
import { join } from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import {
  quoteIdentifier,
  type TransferArchive,
  type TransferDatabase,
  type TransferFile,
} from "./pglite-transfer-format";

export { exportPgliteDatabase } from "./pglite-transfer-export";

// The destination is private staging, never the active application database.
const importArchive = async (db: TransferDatabase, directory: string) => {
  const archive = (await Bun.file(join(directory, "manifest.json")).json()) as TransferArchive;
  const copy = async (table: string, file: TransferFile) => {
    const bytes = await Bun.file(join(directory, file.name)).arrayBuffer();
    if (createHash("sha256").update(new Uint8Array(bytes)).digest("hex") !== file.sha256) {
      throw new Error(`Database transfer chunk checksum mismatch: ${file.name}`);
    }
    await db.query(`copy ${table} from '/dev/blob'`, [], { blob: new Blob([bytes]) });
  };
  await db.exec(await Bun.file(join(directory, "pre-data.sql")).text());
  for (const table of archive.tables) {
    const columns = table.columns.map((column) => quoteIdentifier(column.name)).join(",");
    for (const file of table.files) await copy(`${table.name} (${columns})`, file);
    const count = await db.query<{ count: number }>(`select count(*)::integer as count from ${table.name}`);
    if (count.rows[0].count !== table.rows) throw new Error(`Database transfer row count changed: ${table.name}`);
    const keys = table.columns.filter((column) => column.primary);
    const predicate = keys
      .map((column, index) => `${quoteIdentifier(column.name)}=$${index + 1}::${column.type}`)
      .join(" and ");
    for (const binary of table.binary) {
      await db.exec("create temporary table pstdio_transfer_chunks(position integer primary key,part bytea not null)");
      try {
        for (const file of binary.files) await copy("pg_temp.pstdio_transfer_chunks", file);
        const field = quoteIdentifier(binary.column);
        await db.query(
          `update ${table.name} set ${field}=(select string_agg(part,''::bytea order by position) from pg_temp.pstdio_transfer_chunks)
           where ${predicate}`,
          binary.keys,
        );
        const actual = await db.query<{ length: number; sha256: string }>(
          `select octet_length(${field}) as length,encode(sha256(${field}),'hex') as sha256 from ${table.name} where ${predicate}`,
          binary.keys,
        );
        if (
          actual.rows.length !== 1 ||
          actual.rows[0].length !== binary.length ||
          actual.rows[0].sha256 !== binary.sha256
        ) {
          throw new Error(`Database binary transfer changed: ${table.name}.${binary.column}`);
        }
      } finally {
        await db.exec("drop table pg_temp.pstdio_transfer_chunks");
      }
    }
  }
  for (const sequence of archive.sequences) {
    await db.query("select setval($1::regclass,$2::bigint,$3)", [sequence.name, sequence.value, sequence.called]);
  }
  await db.exec(await Bun.file(join(directory, "post-data.sql")).text());
  await db.exec("set search_path=public");
};

// Verify and publish the private import in one transaction. Committing each COPY
// separately flushes the database repeatedly, especially on Windows filesystems.
export const importPgliteDatabase = (db: Pick<PGlite, "transaction">, directory: string) =>
  db.transaction((transaction) => importArchive(transaction, directory));
