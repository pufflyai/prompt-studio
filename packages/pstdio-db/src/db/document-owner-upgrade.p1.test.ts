import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/pglite/migrator";
import { createDb } from "./connection.pglite";
import { prepareDocumentOwnerUpgrade } from "./document-owner-upgrade";
import { createTextLogOwnerFixture } from "./log-owner-upgrade.fixture";

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
const numeric = new Set(tables.slice(0, 6).concat("storage_record_indexes"));
for (const interruption of ["normal", "schema", "restore"])
  test(`document tails, retry identities, records and numbers survive ${interruption} owner upgrade`, async () => {
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
      const original: Record<string, unknown>[][] = [];
      for (const table of tables)
        original.push(
          (
            await previous.pglite.query<{ row: Record<string, unknown> }>(
              `SELECT to_jsonb(t)${table === "storage_record_indexes" ? "-'database_name'" : ""} AS row FROM ${table} t ORDER BY row`,
            )
          ).rows.map(({ row }) => row),
        );
      if (interruption !== "normal") {
        const finish = await prepareDocumentOwnerUpgrade(previous.db, previous.path);
        for (const table of tables) expect((await previous.pglite.query(`SELECT * FROM ${table}`)).rows).toEqual([]);
        await migrate(previous.db, { migrationsFolder: join(import.meta.dirname, "../../drizzle") });
        if (interruption === "restore") {
          await previous.pglite.exec(`CREATE FUNCTION stop_document_restore() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
            IF NEW.owner_id=(SELECT id FROM owners WHERE project_id='project-b' AND extension_id='pstdio') THEN RAISE EXCEPTION 'stop document restoration'; END IF; RETURN NEW; END $$;
            CREATE TRIGGER stop_document_restore BEFORE INSERT ON storage_document_updates FOR EACH ROW EXECUTE FUNCTION stop_document_restore()`);
          await expect(finish!()).rejects.toThrow("Failed query");
          expect(
            (await previous.pglite.query("SELECT count(*)::int AS count FROM storage_document_updates")).rows,
          ).toEqual([{ count: 400 }]);
          for (const table of tables)
            expect(await Bun.file(`${previous.path}-${table}-owners-upgrade.jsonl`).exists()).toBe(true);
          await previous.pglite.exec("DROP TRIGGER stop_document_restore ON storage_document_updates");
        }
      }
      await previous.close();
      closed = true;
      store = await createDb({ path: previous.path });
      const restored = async () => {
        const rows = [];
        for (const table of tables) {
          const expression = numeric.has(table)
            ? `(to_jsonb(t)-'owner_id') || jsonb_build_object('workbench_id',o.project_id,'extension_id',o.extension_id)`
            : "to_jsonb(t)";
          rows.push(
            (
              await store!.pglite.query<{ row: Record<string, unknown> }>(
                `SELECT (${expression})${table === "storage_record_indexes" ? "-'database_name'" : ""} AS row FROM ${table} t ${numeric.has(table) ? "JOIN owners o ON t.owner_id=o.id" : ""} ORDER BY row`,
              )
            ).rows.map(({ row }) => row),
          );
        }
        return rows;
      };
      expect(await restored()).toEqual(original);
      const countTables = await store.pglite.query<{ database_name: string }>(
        "SELECT database_name FROM storage_record_indexes",
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
      await store.close();
      store = await createDb({ path: previous.path });
      expect(await restored()).toEqual(original);
    } finally {
      if (!closed) await previous.close();
      await store?.close();
      await rm(root, { recursive: true, force: true });
    }
  });
