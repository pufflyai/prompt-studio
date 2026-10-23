import { createHash } from "node:crypto";
import { join } from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import { pgDump } from "@electric-sql/pglite-tools/pg_dump";
import {
  binaryInlineLimit,
  binarySliceBytes,
  quoteIdentifier,
  type TransferArchive,
  type TransferBinary,
  type TransferColumn,
  type TransferTable,
} from "./pglite-transfer-format";

const assertSupportedSchema = async (db: PGlite) => {
  const unsupported = await db.query<{ table: string; reason: string }>(
    `select a.attrelid::regclass::text as table,
      case when a.attgenerated <> '' then 'generated columns' else 'binary check constraints' end as reason
     from pg_attribute a join pg_class r on r.oid=a.attrelid join pg_namespace n on n.oid=r.relnamespace
     where n.nspname not in ('pg_catalog','information_schema') and r.relkind='r' and a.attnum>0 and not a.attisdropped
       and (a.attgenerated <> '' or (a.atttypid=17 and exists(
         select 1 from pg_constraint c where c.conrelid=a.attrelid and c.contype='c' and a.attnum=any(c.conkey))))
     limit 1`,
  );
  if (unsupported.rows.length) {
    throw new Error(`Database transfer does not support ${unsupported.rows[0].reason}: ${unsupported.rows[0].table}`);
  }
};

// The caller owns an immutable source copy. No cursor survives the exporter process.
export const exportPgliteDatabase = async (db: PGlite, directory: string) => {
  await assertSupportedSchema(db);
  for (const section of ["pre-data", "post-data"]) {
    const dump = await pgDump({ pg: db, args: ["--schema-only", `--section=${section}`] });
    await Bun.write(join(directory, `${section}.sql`), dump);
  }
  let nextFile = 0;
  const writeChunk = async (sql: string) => {
    const result = await db.query(sql);
    if (!result.blob) throw new Error("Database COPY returned no transfer data");
    const bytes = await result.blob.arrayBuffer();
    const name = `${nextFile++}.copy`;
    await Bun.write(join(directory, name), bytes);
    return { name, sha256: createHash("sha256").update(new Uint8Array(bytes)).digest("hex") };
  };
  const tables = await db.query<{ schema: string; table: string }>(
    `select table_schema as schema,table_name as table from information_schema.tables
     where table_schema not in ('pg_catalog','information_schema') and table_type='BASE TABLE'
     order by table_schema,table_name`,
  );
  const archive: TransferArchive = { tables: [], sequences: [] };
  for (const table of tables.rows) {
    const name = `${quoteIdentifier(table.schema)}.${quoteIdentifier(table.table)}`;
    const columns = (
      await db.query<TransferColumn>(
        `select a.attname as name,format_type(a.atttypid,a.atttypmod) as type,a.atttypid=17 as binary,
         exists(select 1 from pg_index i where i.indrelid=a.attrelid and i.indisprimary and a.attnum=any(i.indkey)) as primary
         from pg_attribute a where a.attrelid=$1::regclass and a.attnum>0 and not a.attisdropped order by a.attnum`,
        [name],
      )
    ).rows;
    const binary = columns.filter((column) => column.binary);
    const keys = columns.filter((column) => column.primary);
    const selected = columns.map(({ name, binary }) => {
      const column = quoteIdentifier(name);
      return binary
        ? `case when octet_length(${column})>${binaryInlineLimit} then ''::bytea else ${column} end`
        : column;
    });
    const result: TransferTable = { name, columns, rows: 0, files: [], binary: [] };
    const exportRowBinary = async (row: { position: string; keys: string[]; lengths: (number | null)[] }) => {
      for (const [index, column] of binary.entries()) {
        const length = row.lengths[index];
        if (length === null || length <= binaryInlineLimit) continue;
        if (!keys.length || keys.some((key) => key.binary)) {
          throw new Error(`Large binary transfer requires a non-binary primary key: ${name}`);
        }
        const field = quoteIdentifier(column.name);
        const hash = await db.query<{ sha256: string }>(
          `select encode(sha256(${field}),'hex') as sha256 from ${name} where ctid=$1::tid`,
          [row.position],
        );
        const value: TransferBinary = {
          column: column.name,
          keys: row.keys,
          length,
          sha256: hash.rows[0].sha256,
          files: [],
        };
        for (let offset = 0; offset < length; offset += binarySliceBytes) {
          value.files.push(
            await writeChunk(
              `copy (select ${offset} as position,substring(${field} from ${offset + 1} for ${binarySliceBytes}) as part
           from ${name} where ctid='${row.position}'::tid) to '/dev/blob'`,
            ),
          );
        }
        result.binary.push(value);
      }
    };
    let lower = "(0,0)";
    while (true) {
      const page = await db.query<{ position: string; keys: string[]; lengths: (number | null)[] }>(
        `select ctid::text as position,array[${keys.map((column) => `${quoteIdentifier(column.name)}::text`).join(",")}]::text[] as keys,
         array[${binary.map((column) => `octet_length(${quoteIdentifier(column.name)})`).join(",")}]::integer[] as lengths
         from ${name} where ctid>$1::tid order by ctid limit 512`,
        [lower],
      );
      if (!page.rows.length) break;
      const upper = page.rows.at(-1)!.position;
      result.files.push(
        await writeChunk(
          `copy (select ${selected.join(",")} from ${name} where ctid>'${lower}'::tid and ctid<='${upper}'::tid order by ctid) to '/dev/blob'`,
        ),
      );
      for (const row of page.rows) await exportRowBinary(row);
      result.rows += page.rows.length;
      lower = upper;
    }
    archive.tables.push(result);
  }
  const sequences = await db.query<{ schema: string; name: string }>(
    "select schemaname as schema,sequencename as name from pg_sequences where schemaname not in ('pg_catalog','information_schema') order by 1,2",
  );
  for (const sequence of sequences.rows) {
    const name = `${quoteIdentifier(sequence.schema)}.${quoteIdentifier(sequence.name)}`;
    const state = await db.query<{ value: string; called: boolean }>(
      `select last_value::text as value,is_called as called from ${name}`,
    );
    archive.sequences.push({ name, ...state.rows[0] });
  }
  await Bun.write(join(directory, "manifest.json"), JSON.stringify(archive));
};
