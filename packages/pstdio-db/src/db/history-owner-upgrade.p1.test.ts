import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/pglite/migrator";
import { createPersonalHistoryIndex } from "../services/extension-storage/personal-history-index";
import { createDb } from "./connection.pglite";
import { prepareHistoryOwnerUpgrade } from "./history-owner-upgrade";
import { createTextLogOwnerFixture } from "./log-owner-upgrade.fixture";

for (const interruption of ["normal", "schema", "restore"])
  test(`private history and its covered cursor survive ${interruption} ownership upgrade`, async () => {
    const root = await mkdtemp(join(tmpdir(), "history-owner-upgrade-"));
    const previous = await createTextLogOwnerFixture(root);
    let previousClosed = false;
    let store: Awaited<ReturnType<typeof createDb>> | undefined;
    try {
      await previous.pglite.exec(`INSERT INTO projects (id,name,shorthand,created_at,updated_at)
        VALUES ('project-a','A','A','2026-11-20T12:00:00.000Z','2026-11-20T12:00:00.000Z'),
        ('project-b','B','B','2026-11-20T12:00:00.000Z','2026-11-20T12:00:00.000Z');
        INSERT INTO storage_personal_history (workbench_id,extension_id,device_id,kind,record_id,value,seed_id,pending_id)
        SELECT p.id,'private-alice','laptop','sessions','session-' || n,
          CASE WHEN n % 10 = 0 THEN NULL ELSE jsonb_build_object('id','session-' || n,'title','日本語 😀','pending',true) END,
          CASE WHEN n % 3 = 0 THEN 'seed-' || n ELSE NULL END, 'pending-' || n
        FROM projects p CROSS JOIN generate_series(0,200) n;
        INSERT INTO storage_personal_history_sources (workbench_id,extension_id,source_id,kind,device_id,record_id,value,seed_id,entry_id,sequence,entry_index)
        SELECT workbench_id,extension_id,'laptop',kind,device_id,record_id,
          CASE WHEN value IS NULL THEN NULL ELSE value || '{"pending":false}'::jsonb END,
          seed_id,'accepted-' || record_id,1701,7 FROM storage_personal_history;
        INSERT INTO storage_personal_history_positions (workbench_id,extension_id,cursor,migrated)
        SELECT id,'private-alice','{"version":2,"sources":{"laptop":1701}}',true FROM projects;`);
      const released = async (table: string, order: string) =>
        (await previous.pglite.query<Record<string, unknown>>(`SELECT * FROM ${table} ORDER BY ${order}`)).rows;
      const originalRows = await released("storage_personal_history", "workbench_id,kind,device_id,record_id");
      const originalSources = await released(
        "storage_personal_history_sources",
        "workbench_id,source_id,kind,device_id,record_id",
      );
      const originalPositions = await released("storage_personal_history_positions", "workbench_id");
      if (interruption !== "normal") {
        const finish = await prepareHistoryOwnerUpgrade(previous.db, previous.path);
        await migrate(previous.db, { migrationsFolder: join(import.meta.dirname, "../../drizzle") });
        if (interruption === "restore") {
          await previous.pglite.exec(`CREATE FUNCTION stop_history_restore() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN IF NEW.record_id='session-100' THEN RAISE EXCEPTION 'stop restoration'; END IF; RETURN NEW; END $$;
            CREATE TRIGGER stop_history_restore BEFORE INSERT ON history_sources FOR EACH ROW EXECUTE FUNCTION stop_history_restore()`);
          await expect(finish!()).rejects.toThrow("Failed query");
          for (const name of ["history-row-owners", "history-source-owners", "history-owner-positions"])
            expect(await Bun.file(`${previous.path}-${name}-upgrade.jsonl`).exists()).toBe(true);
          await previous.pglite.exec("DROP TRIGGER stop_history_restore ON history_sources");
        }
      }
      await previous.close();
      previousClosed = true;
      store = await createDb({ path: previous.path });
      const rows = (
        await store.pglite.query(`SELECT owners.project_id AS workbench_id, owners.extension_id,
        h.device_id,h.kind,h.record_id,h.value,h.seed_id,h.pending_id FROM history_rows h JOIN owners ON h.owner_id=owners.id
        ORDER BY owners.project_id,h.kind,h.device_id,h.record_id`)
      ).rows;
      const sources = (
        await store.pglite.query(`SELECT owners.project_id AS workbench_id, owners.extension_id,
        h.source_id,h.kind,h.device_id,h.record_id,h.value,h.seed_id,h.entry_id,h.sequence,h.entry_index
        FROM history_sources h JOIN owners ON h.owner_id=owners.id
        ORDER BY owners.project_id,h.source_id,h.kind,h.device_id,h.record_id`)
      ).rows;
      expect(rows).toEqual(originalRows);
      expect(sources).toEqual(originalSources);
      const archive = async (name: string) =>
        (await readFile(`${previous.path}-migration-exports/${name}.jsonl`, "utf8"))
          .trim()
          .split("\n")
          .map((line) => JSON.parse(line));
      expect(await archive("history-rows")).toEqual(originalRows);
      expect(await archive("history-sources")).toEqual(originalSources);
      expect(await archive("history-positions")).toEqual(originalPositions);
      const owner = { workbenchId: "project-a", extensionId: "private-alice" };
      const index = createPersonalHistoryIndex(store.db);
      expect(await index.sourcePosition(owner, "laptop")).toBe(1701);
      expect(await index.migrated(owner)).toBe(true);
      expect(await index.get(owner, "sessions", "session-101")).toMatchObject({ pending: true });
      expect((await index.sourcePage(owner, "laptop"))[0]?.delta.value).toBeNull();
      await store.close();
      store = await createDb({ path: previous.path });
      expect(await createPersonalHistoryIndex(store.db).sourcePosition(owner, "laptop")).toBe(1701);
      expect(await Bun.file(`${previous.path}-history-row-owners-upgrade.jsonl`).exists()).toBe(false);
    } finally {
      if (!previousClosed) await previous.close();
      await store?.close();
      await rm(root, { recursive: true, force: true });
    }
  }, 15_000);
