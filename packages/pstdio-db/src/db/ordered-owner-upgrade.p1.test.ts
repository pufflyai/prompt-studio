import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/pglite/migrator";
import { createDb } from "./connection.pglite";
import { createTextLogOwnerFixture } from "./log-owner-upgrade.fixture";
import { prepareOrderedOwnerUpgrade } from "./ordered-owner-upgrade";

const tables = [
  "storage_ordered_owners",
  "storage_ordered_operations",
  "storage_ordered_records",
  "storage_ordered_touches",
  "storage_ordered_receipts",
];
for (const interruption of ["normal", "schema", "restore"])
  test(`ordered owner upgrade preserves exact state, retries and sequence positions after ${interruption}`, async () => {
    const root = await mkdtemp(join(tmpdir(), "ordered-owner-upgrade-"));
    const old = await createTextLogOwnerFixture(root);
    let oldClosed = false;
    let current: Awaited<ReturnType<typeof createDb>> | undefined;
    try {
      await old.pglite.exec(`INSERT INTO projects (id,name,shorthand,created_at,updated_at)
        VALUES ('project-a','A','A','2026-11-20T12:00:00.000Z','2026-11-20T12:00:00.000Z'),
        ('project-b','B','B','2026-11-20T12:00:00.000Z','2026-11-20T12:00:00.000Z');
        INSERT INTO storage_ordered_owners (workbench_id,extension_id,epoch,joined,"after",state_id,through,
          pending_bytes,state_bytes,skipped,receipt_root)
        VALUES ('project-a','example.records','cloud',true,71,'latest',68,4096,8192,true,decode('00ff02','hex')),
          ('project-a','example.other','local:other',false,1,NULL,0,0,0,false,NULL),
          ('project-b','example.records','local:second',false,0,NULL,0,0,0,false,NULL);
        INSERT INTO storage_ordered_operations (workbench_id,extension_id,operation_id,fingerprint,local_sequence,
          request_fingerprint,envelope,admission_epoch,admission,admission_fingerprint,delivered,settled_epoch)
        SELECT workbench_id,extension_id,'operation-' || n,'fingerprint-' || n,n+1,'request-' || n,
          decode('00ff0100','hex'),'earlier',decode('0100ff','hex'),'admission-' || n,n%2=0,
          CASE WHEN n%3=0 THEN 'earlier' ELSE NULL END FROM storage_ordered_owners CROSS JOIN generate_series(0,200) n;
        INSERT INTO storage_ordered_records SELECT workbench_id,extension_id,'same-record',decode('00fe0001','hex')
          FROM storage_ordered_owners;
        INSERT INTO storage_ordered_touches SELECT workbench_id,extension_id,'same-record',operation_id,local_sequence
          FROM storage_ordered_operations WHERE settled_epoch IS NULL;
        INSERT INTO storage_ordered_receipts SELECT workbench_id,extension_id,'earlier',operation_id,
          admission_fingerprint,CASE WHEN delivered THEN 'accepted' ELSE 'refused' END,delivered
          FROM storage_ordered_operations;
        SELECT setval('storage_ordered_operations_local_sequence_seq',9001,true)`);
      const original: Record<string, unknown[]> = {};
      for (const table of tables)
        original[table] = (
          await old.pglite.query<{ row: unknown }>(`SELECT to_jsonb(t) AS row FROM ${table} t
          ORDER BY workbench_id,extension_id,to_jsonb(t)::text`)
        ).rows.map((row) => row.row);
      if (interruption !== "normal") {
        const finish = await prepareOrderedOwnerUpgrade(old.db, old.path);
        for (const table of tables) expect((await old.pglite.query(`SELECT * FROM ${table}`)).rows).toEqual([]);
        await migrate(old.db, { migrationsFolder: join(import.meta.dirname, "../../drizzle") });
        if (interruption === "restore") {
          await old.pglite.exec(`CREATE FUNCTION stop_ordered_restore() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN IF NEW.operation_id='operation-99' THEN RAISE EXCEPTION 'stop restoration'; END IF; RETURN NEW; END $$;
            CREATE TRIGGER stop_ordered_restore BEFORE INSERT ON storage_ordered_operations FOR EACH ROW
              EXECUTE FUNCTION stop_ordered_restore()`);
          await expect(finish!()).rejects.toThrow("Failed query");
          expect(
            (await old.pglite.query<{ count: number }>("SELECT count(*)::int AS count FROM storage_ordered_operations"))
              .rows[0]!.count,
          ).toBe(200);
          for (const table of tables) {
            const lines = (await readFile(`${old.path}-${table}-owners-upgrade.jsonl`, "utf8")).trim().split("\n");
            expect(lines).toHaveLength(original[table]!.length);
          }
          await old.pglite.exec("DROP TRIGGER stop_ordered_restore ON storage_ordered_operations");
        }
      }
      await old.close();
      oldClosed = true;
      current = await createDb({ path: old.path });
      const verify = async () => {
        for (const table of tables) {
          const rows = (
            await current!.pglite.query<{ row: unknown }>(`SELECT (to_jsonb(t)-'owner_id') ||
            jsonb_build_object('workbench_id',o.project_id,'extension_id',o.extension_id) AS row
            FROM ${table} t JOIN owners o ON t.owner_id=o.id
            ORDER BY o.project_id,o.extension_id,((to_jsonb(t)-'owner_id') ||
              jsonb_build_object('workbench_id',o.project_id,'extension_id',o.extension_id))::text`)
          ).rows;
          expect(rows.map((row) => row.row)).toEqual(original[table]);
        }
      };
      await verify();
      expect(
        (
          await current.pglite.query<{ last_value: number }>(
            "SELECT last_value FROM storage_ordered_operations_local_sequence_seq",
          )
        ).rows[0]!.last_value,
      ).toBe(9001);
      for (const table of tables) {
        expect(await Bun.file(`${old.path}-${table}-owners-upgrade.jsonl`).exists()).toBe(false);
        const archive = (await readFile(`${old.path}-migration-exports/${table}.jsonl`, "utf8")).trim().split("\n");
        expect(archive).toHaveLength(original[table]!.length);
      }
      await current.close();
      current = await createDb({ path: old.path });
      await verify();
    } finally {
      if (!oldClosed) await old.close();
      await current?.close();
      await rm(root, { recursive: true, force: true });
    }
  });
