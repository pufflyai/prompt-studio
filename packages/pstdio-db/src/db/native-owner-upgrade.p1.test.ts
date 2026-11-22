import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/pglite/migrator";
import { createDb } from "./connection.pglite";
import { createTextLogOwnerFixture } from "./log-owner-upgrade.fixture";
import { prepareNativeOwnerUpgrade } from "./native-owner-upgrade";

const tables = [
  "native_document_sources",
  "native_document_rooms",
  "native_document_room_updates",
  "native_document_file_projections",
];
const order = [
  "workbench_id,extension_id,document_key",
  "id",
  "room_id,revision",
  "workbench_id,extension_id,document_key,projection_key",
];
for (const interruption of ["normal", "schema", "restore"])
  test(`native editor history and unfinished file copies survive ${interruption} owner upgrade`, async () => {
    const root = await mkdtemp(join(tmpdir(), "native-owner-upgrade-"));
    const previous = await createTextLogOwnerFixture(root);
    let previousClosed = false;
    let store: Awaited<ReturnType<typeof createDb>> | undefined;
    try {
      await previous.pglite.exec(`INSERT INTO projects (id,name,shorthand,created_at,updated_at)
        VALUES ('project-a','A','A','2026-11-22T09:00:00.000Z','2026-11-22T09:00:00.000Z'),
        ('project-b','B','B','2026-11-22T09:00:00.000Z','2026-11-22T09:00:00.000Z');
        INSERT INTO native_document_sources SELECT 'project-a','example.editor','document-' || lpad(n::text,3,'0'),
          CASE WHEN n%2=0 THEN NULL ELSE '{"fileRendererId":"example.editor"}'::jsonb END FROM generate_series(0,200) n;
        INSERT INTO native_document_sources SELECT 'project-b',extension_id,document_key,target
          FROM native_document_sources WHERE document_key='document-000';
        INSERT INTO native_document_sources SELECT 'project-a','example.other',document_key,target
          FROM native_document_sources WHERE workbench_id='project-b';
        INSERT INTO native_document_rooms SELECT 'room-' || workbench_id || '-' || extension_id || '-' || document_key,
          workbench_id,extension_id,document_key,decode('000180ff','hex'),3,1 FROM native_document_sources;
        INSERT INTO native_document_room_updates SELECT id,r,decode(CASE WHEN r=2 THEN '' ELSE 'ff0001' END,'hex')
          FROM native_document_rooms CROSS JOIN generate_series(2,3) r;
        INSERT INTO native_document_file_projections SELECT workbench_id,extension_id,document_key,p,
          CASE WHEN p='handler' THEN decode('00ff','hex') ELSE NULL END,
          CASE WHEN p='handler' THEN decode('ff80','hex') ELSE NULL END,42
          FROM native_document_sources CROSS JOIN unnest(ARRAY['handler','mirror']) p;`);
      const original: Record<string, unknown>[][] = [];
      for (const [i, table] of tables.entries())
        original.push(
          (await previous.pglite.query<Record<string, unknown>>(`SELECT * FROM ${table} ORDER BY ${order[i]}`)).rows,
        );
      if (interruption !== "normal") {
        const finish = await prepareNativeOwnerUpgrade(previous.db, previous.path);
        for (const table of tables) expect((await previous.pglite.query(`SELECT * FROM ${table}`)).rows).toEqual([]);
        await migrate(previous.db, { migrationsFolder: join(import.meta.dirname, "../../drizzle") });
        if (interruption === "restore") {
          await previous.pglite.exec(`CREATE FUNCTION stop_native_restore() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN IF starts_with(NEW.room_id,'room-project-b-') THEN RAISE EXCEPTION 'stop native restoration';
            END IF; RETURN NEW; END $$;
            CREATE TRIGGER stop_native_restore BEFORE INSERT ON native_document_room_updates
              FOR EACH ROW EXECUTE FUNCTION stop_native_restore()`);
          await expect(finish!()).rejects.toThrow("Failed query");
          expect(
            (await previous.pglite.query("SELECT count(*)::int AS count FROM native_document_room_updates")).rows,
          ).toEqual([{ count: 400 }]);
          for (const table of tables)
            expect(await Bun.file(`${previous.path}-${table}-owners-upgrade.jsonl`).exists()).toBe(true);
          await previous.pglite.exec("DROP TRIGGER stop_native_restore ON native_document_room_updates");
        }
      }
      await previous.close();
      previousClosed = true;
      store = await createDb({ path: previous.path });
      const restored = async () => {
        const result = [];
        for (const [i, table] of tables.entries()) {
          if (table === "native_document_room_updates")
            result.push((await store!.pglite.query(`SELECT * FROM ${table} ORDER BY ${order[i]}`)).rows);
          else {
            // Compare SQL rows so bytea and bigint retain the released driver's exact types.
            const columns = Object.keys(original[i]![0]!);
            result.push(
              (
                await store!.pglite.query(`SELECT ${columns
                  .map((c) => {
                    if (c === "workbench_id") return "o.project_id AS workbench_id";
                    if (c === "extension_id") return "o.extension_id";
                    return `n.${c}`;
                  })
                  .join(",")}
              FROM ${table} n JOIN owners o ON n.owner_id=o.id ORDER BY ${order[i]}`)
              ).rows,
            );
          }
        }
        return result;
      };
      expect(await restored()).toEqual(original);
      for (const [i, table] of tables.entries()) {
        const archived = (await readFile(`${previous.path}-migration-exports/${table}.jsonl`, "utf8"))
          .trim()
          .split("\n");
        expect(archived).toHaveLength(original[i]!.length);
        expect(await Bun.file(`${previous.path}-${table}-owners-upgrade.jsonl`).exists()).toBe(false);
      }
      await store.close();
      store = await createDb({ path: previous.path });
      expect(await restored()).toEqual(original);
    } finally {
      if (!previousClosed) await previous.close();
      await store?.close();
      await rm(root, { recursive: true, force: true });
    }
  });
