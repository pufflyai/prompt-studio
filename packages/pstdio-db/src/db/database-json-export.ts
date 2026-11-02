import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { readDocumentRecord } from "pstdio-sync/records";
import * as Y from "yjs";

/** The query surface shared by the previous and the current PGlite engine. */
interface ExportDatabase {
  query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

const readme = `# Prompt Studio data from before 0.46

Prompt Studio 0.46 starts with a new database. This folder keeps everything the old one held.

- \`tables/<schema>.<table>.jsonl\`: every table, one JSON row per line. Binary columns are hex strings.
- \`extension-records/<project id>/<extension id>.jsonl\`: extension data such as tickets, decoded into
  plain records with \`recordId\`, \`value\`, \`shared\`, \`asset\`, and \`deleted\`.
- \`../database\`: the original database folder, unchanged except for this export.

To bring data back, ask an agent to read these files and recreate what you need with the \`pst\` CLI.
`;

const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;

const writeLines = async (path: string, read: (write: (value: unknown) => void) => Promise<void>) => {
  const writer = Bun.file(path).writer();
  try {
    await read((value) => writer.write(`${JSON.stringify(value)}\n`));
  } finally {
    await writer.end();
  }
};

const exportTables = async (db: ExportDatabase, directory: string, failed: (part: string, error: unknown) => void) => {
  await mkdir(directory, { recursive: true });
  const tables = await db.query<{ schema: string; table: string }>(
    `select table_schema as schema, table_name as table from information_schema.tables
     where table_schema not in ('pg_catalog', 'information_schema', 'drizzle') and table_type = 'BASE TABLE'
     order by 1, 2`,
  );
  for (const { schema, table } of tables.rows) {
    const name = `${quote(schema)}.${quote(table)}`;
    // Binary columns hold whole documents, which become hex text twice their size, so read few rows at once.
    const binary = await db.query(
      "select 1 from information_schema.columns where table_schema = $1 and table_name = $2 and data_type = 'bytea'",
      [schema, table],
    );
    const pageSize = binary.rows.length ? 10 : 200;
    try {
      await writeLines(join(directory, `${schema}.${table}.jsonl`), async (write) => {
        // Page by physical position so one large table never sits in memory at once.
        let after = "(0,0)";
        while (true) {
          // A column can share the alias's name, and Postgres would read the column instead of the row.
          const page = await db.query<{ position: string; row: unknown }>(
            `select ctid::text as position, row_to_json(pstdio_exported_row) as row from ${name} pstdio_exported_row
             where ctid > $1::tid order by ctid limit ${pageSize}`,
            [after],
          );
          if (!page.rows.length) return;
          for (const { row } of page.rows) write(row);
          after = page.rows.at(-1)!.position;
        }
      });
    } catch (error) {
      failed(`tables/${schema}.${table}.jsonl`, error);
    }
  }
};

const exportExtensionRecords = async (
  db: ExportDatabase,
  directory: string,
  failed: (part: string, error: unknown) => void,
) => {
  const present = await db.query<{ present: boolean }>(
    "select to_regclass('public.storage_documents') is not null as present",
  );
  if (!present.rows[0].present) return;
  const owners = await db.query<{ workbench_id: string; extension_id: string }>(
    "select distinct workbench_id, extension_id from storage_documents order by 1, 2",
  );
  for (const owner of owners.rows) {
    const part = `extension-records/${owner.workbench_id}/${owner.extension_id}.jsonl`;
    try {
      await exportOwnerRecords(db, directory, owner, (documentId, error) =>
        failed(`${part} (document ${documentId})`, error),
      );
    } catch (error) {
      failed(part, error);
    }
  }
};

type ExportedRecord = Omit<Awaited<ReturnType<typeof readDocumentRecord>>, "revision" | "exists">;

const readDocumentRecords = async (db: ExportDatabase, address: [string, string, string]) => {
  const state = await db.query<{ state: Uint8Array }>(
    "select state from storage_documents where workbench_id = $1 and extension_id = $2 and document_id = $3",
    address,
  );
  const updates = await db.query<{ update: Uint8Array }>(
    `select "update" from storage_document_updates
     where workbench_id = $1 and extension_id = $2 and document_id = $3 order by revision`,
    address,
  );
  const document = new Y.Doc();
  try {
    Y.applyUpdate(document, state.rows[0].state);
    for (const { update } of updates.rows) Y.applyUpdate(document, update);
    const ids = new Set([...document.getMap("records").keys(), ...document.getMap("deleted").keys()]);
    const records: ExportedRecord[] = [];
    for (const id of ids) {
      const { revision: _revision, exists: _exists, ...record } = await readDocumentRecord(document, id);
      records.push(record);
    }
    return records;
  } finally {
    document.destroy();
  }
};

const exportOwnerRecords = async (
  db: ExportDatabase,
  directory: string,
  owner: { workbench_id: string; extension_id: string },
  failed: (documentId: string, error: unknown) => void,
) => {
  await mkdir(join(directory, owner.workbench_id), { recursive: true });
  const records: ExportedRecord[] = [];
  const documents = await db.query<{ document_id: string }>(
    "select document_id from storage_documents where workbench_id = $1 and extension_id = $2 order by 1",
    [owner.workbench_id, owner.extension_id],
  );
  // One damaged document must not cost the owner's healthy records, so each document reads on its own.
  for (const { document_id } of documents.rows) {
    try {
      const address: [string, string, string] = [owner.workbench_id, owner.extension_id, document_id];
      for (const record of await readDocumentRecords(db, address)) records.push(record);
    } catch (error) {
      failed(document_id, error);
    }
  }
  records.sort((left, right) => (left.recordId < right.recordId ? -1 : 1));
  await writeLines(join(directory, owner.workbench_id, `${owner.extension_id}.jsonl`), async (write) => {
    for (const record of records) write(record);
  });
};

/**
 * Writes an old database as JSON lines that people and agents can read without Prompt Studio.
 * Decoded extension records come first because they matter most. A part that fails is listed in
 * `errors.txt` and the rest still export.
 */
export const exportDatabaseAsJson = async (db: ExportDatabase, directory: string) => {
  await mkdir(directory, { recursive: true });
  const errors: string[] = [];
  const failed = (part: string, error: unknown) =>
    errors.push(`${part}: ${error instanceof Error ? error.message : String(error)}`);
  await Bun.write(join(directory, "README.md"), readme);
  await exportExtensionRecords(db, join(directory, "extension-records"), failed);
  await exportTables(db, join(directory, "tables"), failed);
  if (errors.length) await Bun.write(join(directory, "errors.txt"), `${errors.join("\n")}\n`);
};
