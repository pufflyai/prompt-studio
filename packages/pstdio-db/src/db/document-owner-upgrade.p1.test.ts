import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/pglite/migrator";
import { createDb } from "./connection.pglite";
import { prepareDocumentOwnerUpgrade } from "./document-owner-upgrade";
import { createTextLogOwnerFixture } from "./log-owner-upgrade.fixture";
import { prepareOrderedOwnerUpgrade } from "./ordered-owner-upgrade";
import { prepareOwnerIndexUpgrade } from "./owner-index-upgrade";
import { prepareOwnerProjectionUpgrade } from "./owner-projection-upgrade";
import { countDocumentUpdates, releasedDocumentRows } from "./released-document-rows.fixture";
import { releasedRecordRows } from "./released-record-rows.fixture";

const tables = [
  "storage_documents",
  "storage_document_updates",
  "storage_document_operations",
  "storage_record_projections",
  "storage_current_records",
  "storage_resource_projections",
  "storage_resource_identities",
  "storage_resource_aliases",
  "storage_record_indexes",
];
const compare = (first: string, second: string) => {
  if (first === second) return 0;
  return first < second ? -1 : 1;
};
const sorted = (rows: Record<string, unknown>[][]) =>
  rows.map((table) =>
    table
      .map((row) => Object.fromEntries(Object.entries(row).sort(([a], [b]) => compare(a, b))))
      .sort((a, b) => compare(JSON.stringify(a), JSON.stringify(b))),
  );
const numeric = new Set(tables.slice(0, 6).concat("storage_record_indexes"));
const readRestoredTable = async (
  store: Awaited<ReturnType<typeof createDb>>["pglite"],
  table: string,
  fileRows: Awaited<ReturnType<typeof releasedDocumentRows>>,
) => {
  if (tables.slice(0, 3).includes(table) || table === "storage_current_records") return fileRows[table]!;
  if (table === "storage_resource_identities" || table === "storage_resource_aliases") {
    const value =
      table === "storage_resource_identities"
        ? "jsonb_build_object('workbench_id',project_id,'resource_id',resource_id,'extension_id',extension_id,'kind',kind,'shorthand',shorthand,'prefix',prefix,'value',value)"
        : "jsonb_build_object('workbench_id',project_id,'resource_id',resource_id,'shorthand',shorthand,'prefix',prefix,'value',value)";
    return (
      await store.query<{ row: Record<string, unknown> }>(`SELECT ${value} AS row
    FROM resource_numbers WHERE ${table === "storage_resource_identities" ? "current" : "alias"} ORDER BY row`)
    ).rows.map(({ row }) => row);
  }
  if (table === "storage_resource_projections") {
    return (
      await store.query<{ row: Record<string, unknown> }>(`SELECT
    jsonb_build_object('workbench_id',project_id,'extension_id',extension_id,'document_id','records',
      'revision',numbers_revision) AS row FROM owners WHERE extension_id='pstdio'
      AND EXISTS(SELECT 1 FROM documents d WHERE d.owner_id=owners.id AND d.key='records')
    ORDER BY row`)
    ).rows.map(({ row }) => row);
  }
  if (table === "storage_record_indexes") {
    return (
      await store.query<{
        row: Record<string, unknown>;
      }>(`SELECT jsonb_build_object('workbench_id',o.project_id,
    'extension_id',o.extension_id,'name',entry.key,'definition',entry.value->'definition') AS row
    FROM owners o CROSS JOIN LATERAL jsonb_each(o.record_indexes) AS entry(key,value) ORDER BY row`)
    ).rows.map(({ row }) => row);
  }
  if (table === "storage_record_projections") {
    return (
      await store.query<{
        row: Record<string, unknown>;
      }>(`SELECT jsonb_build_object('workbench_id',o.project_id,
    'extension_id',o.extension_id,'document_id','records','revision',o.revision,'live_count',o.live_count) AS row
    FROM owners o WHERE EXISTS (SELECT 1 FROM documents d WHERE d.owner_id=o.id AND d.key='records') ORDER BY row`)
    ).rows.map(({ row }) => row);
  }
  const expression = numeric.has(table)
    ? `(to_jsonb(t)-'owner_id') || jsonb_build_object('workbench_id',o.project_id,'extension_id',o.extension_id)`
    : "to_jsonb(t)";
  return (
    await store.query<{ row: Record<string, unknown> }>(
      `SELECT (${expression})${table === "storage_record_indexes" ? "-'database_name'" : ""} AS row FROM ${table} t ${numeric.has(table) ? "JOIN owners o ON t.owner_id=o.id" : ""} ORDER BY row`,
    )
  ).rows.map(({ row }) => row);
};
for (const interruption of ["normal", "schema", "restore"]) {
  const name = `document tails, retry identities, records and numbers survive ${interruption} owner upgrade`;
  const check = async () => {
    const phases: Record<string, number> = {};
    let phaseStart = performance.now();
    const markPhase = (phase: string) => {
      const now = performance.now();
      phases[phase] = Math.round(now - phaseStart);
      phaseStart = now;
    };
    const root = await mkdtemp(join(tmpdir(), "document-owner-upgrade-"));
    const previous = await createTextLogOwnerFixture(root);
    let closed = false;
    let store: Awaited<ReturnType<typeof createDb>> | undefined;
    try {
      await previous.pglite.exec(`INSERT INTO projects (id,name,shorthand,created_at,updated_at)
      VALUES ('project-a','A','A','2026-11-22','2026-11-22'),('project-b','B','B','2026-11-22','2026-11-22');
      INSERT INTO storage_documents SELECT 'project-a','pstdio',CASE WHEN n=0 THEN 'records' ELSE 'document-' || lpad(n::text,3,'0') END,
        decode('00ff0180','hex'),3,1 FROM generate_series(0,200) n;
      INSERT INTO storage_documents SELECT 'project-b',extension_id,document_id,state,revision,folded_revision FROM storage_documents WHERE document_id='records';
      INSERT INTO storage_documents SELECT 'project-a','example.other',document_id,state,revision,folded_revision FROM storage_documents WHERE workbench_id='project-b';
      INSERT INTO storage_document_updates SELECT workbench_id,extension_id,document_id,r,decode(CASE WHEN r=2 THEN '' ELSE 'ff00' END,'hex') FROM storage_documents CROSS JOIN generate_series(2,3) r;
      INSERT INTO storage_document_operations SELECT workbench_id,extension_id,document_id,'same-operation','exact-' || document_id FROM storage_documents;
      INSERT INTO storage_document_operations SELECT 'project-a','pstdio','document-001','retry-' || n,'exact-retry-' || n FROM generate_series(1,401) n;
      INSERT INTO storage_record_projections (workbench_id,extension_id,document_id,revision,live_count) SELECT workbench_id,extension_id,'records',73,1 FROM storage_documents WHERE document_id='records';
      INSERT INTO storage_current_records (workbench_id,extension_id,record_id,deleted,value,query_values,revision,record_lifetime)
        SELECT workbench_id,extension_id,document_id,false,'{"state":"open"}'::jsonb,'{"things":{"state":"open"}}'::jsonb,'same-revision','life-' || document_id FROM storage_documents;
      INSERT INTO storage_resource_projections SELECT workbench_id,extension_id,document_id,73 FROM storage_documents WHERE document_id='records' AND extension_id='pstdio';
      INSERT INTO storage_resource_identities SELECT workbench_id,'same-resource','example.items','item','IT-700','IT',700 FROM storage_resource_projections;
      INSERT INTO storage_resource_aliases SELECT workbench_id,resource_id,'IT-900','IT',900 FROM storage_resource_identities;
      INSERT INTO storage_record_indexes SELECT workbench_id,extension_id,'things',
        '{"name":"things","fields":{"state":{"type":"string","path":["state"],"derive":{"kind":"string"}}},"countBy":["state"]}'::jsonb,'old-query-' || workbench_id || '-' || extension_id FROM storage_record_projections;`);
      await previous.pglite.exec(`INSERT INTO storage_documents (workbench_id,extension_id,document_id,state)
      SELECT id,'pstdio','["host-local-migration","first-party-identities-v1"]',decode('0000','hex') FROM projects`);
      // This fixture exercises exact structural rewrites of already-ordered owners.
      // Real legacy Yjs conversion and failure isolation have their own admission tests.
      await previous.pglite.exec(`INSERT INTO storage_ordered_owners (workbench_id,extension_id)
      SELECT workbench_id,extension_id FROM storage_record_projections`);
      const original: Record<string, unknown>[][] = [];
      for (const table of tables)
        original.push(
          (
            await previous.pglite.query<{ row: Record<string, unknown> }>(
              `SELECT to_jsonb(t)${table === "storage_record_indexes" ? "-'database_name'" : ""} AS row FROM ${table} t ORDER BY row`,
            )
          ).rows.map(({ row }) => row),
        );
      markPhase("fixture and original rows");
      if (interruption !== "normal") {
        await prepareOrderedOwnerUpgrade(previous.db, previous.path);
        await prepareOwnerIndexUpgrade(previous.db, previous.path);
        await prepareOwnerProjectionUpgrade(previous.db, previous.path);
        const finish = await prepareDocumentOwnerUpgrade(previous.db, previous.path);
        for (const table of tables) expect((await previous.pglite.query(`SELECT * FROM ${table}`)).rows).toEqual([]);
        await migrate(previous.db, { migrationsFolder: join(import.meta.dirname, "../../drizzle") });
        markPhase("snapshot export and schema migration");
        if (interruption === "restore") {
          await previous.pglite.exec(`CREATE FUNCTION stop_document_restore() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
          IF NEW.owner_id=(SELECT id FROM owners WHERE project_id='project-b' AND extension_id='pstdio') THEN RAISE EXCEPTION 'stop document restoration'; END IF; RETURN NEW; END $$;
          CREATE TRIGGER stop_document_restore BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION stop_document_restore()`);
          await expect(finish!()).rejects.toThrow("Failed query");
          expect(await countDocumentUpdates(previous.db, false)).toBe(400);
          for (const table of tables)
            expect(await Bun.file(`${previous.path}-${table}-owners-upgrade.jsonl`).exists()).toBe(true);
          await previous.pglite.exec("DROP TRIGGER stop_document_restore ON documents");
        }
      }
      markPhase("interrupted restore");
      await previous.close();
      closed = true;
      store = await createDb({ path: previous.path, onPhase: markPhase });
      const restored = async () => {
        const fileRows = { ...(await releasedDocumentRows(store!)), ...(await releasedRecordRows(store!.db)) };
        return Promise.all(tables.map((table) => readRestoredTable(store!.pglite, table, fileRows)));
      };
      expect(sorted(await restored())).toEqual(sorted(original));
      const countTables = await store.pglite.query<{ database_name: string }>(
        "SELECT entry.value->>'database_name' AS database_name FROM owners o CROSS JOIN LATERAL jsonb_each(o.record_indexes) AS entry(key,value)",
      );
      for (const { database_name } of countTables.rows) {
        const result = await store.pglite.query<{ n: string }>(`SELECT sum(n)::text AS n FROM ${database_name}_c`);
        expect(Number(result.rows[0]!.n)).toBeGreaterThan(0);
      }
      for (const [i, table] of tables.entries()) {
        expect(
          (await readFile(`${previous.path}-migration-exports/${table}.jsonl`, "utf8")).trim().split("\n"),
        ).toHaveLength(original[i]!.length);
        expect(await Bun.file(`${previous.path}-${table}-owners-upgrade.jsonl`).exists()).toBe(false);
      }
      markPhase("resume and verify restored data");
      await store.close();
      store = await createDb({ path: previous.path });
      expect(sorted(await restored())).toEqual(sorted(original));
      markPhase("reopen and verify durable data");
    } finally {
      if (!closed) await previous.close();
      await store?.close();
      await rm(root, { recursive: true, force: true });
      markPhase("cleanup");
      console.info("Document owner upgrade phases (ms)", interruption, JSON.stringify(phases));
    }
  };
  // Each variant restores 401 additional retry facts across committed batches,
  // collects obsolete files and verifies durability on a second reopen.
  test(name, check, 10_000);
}
