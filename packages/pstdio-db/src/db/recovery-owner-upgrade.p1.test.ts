import { expect, test } from "bun:test";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/pglite/migrator";
import { recoveryFilesFor } from "../services/extension-storage/recovery-files";
import { createDb } from "./connection.pglite";
import { createTextLogOwnerFixture } from "./log-owner-upgrade.fixture";
import { prepareRecoveryOwnerUpgrade } from "./recovery-owner-upgrade";
import { recovery_points } from "./schemas.pg";

type ReleasedRecoveryRow = {
  workbench_id: string;
  hours: number;
  extension_id: string;
  revision: number;
  records: Uint8Array<ArrayBuffer>;
  metadata: Uint8Array<ArrayBuffer>;
};

for (const interruption of ["normal", "schema", "restore", "large"])
  test(`recovery copies retain their exact bytes and capture times after ${interruption} owner upgrade`, async () => {
    const root = await mkdtemp(join(tmpdir(), "recovery-owner-upgrade-"));
    const previous = await createTextLogOwnerFixture(root);
    let previousClosed = false;
    let store: Awaited<ReturnType<typeof createDb>> | undefined;
    try {
      await previous.pglite.exec(`INSERT INTO projects (id,name,shorthand,created_at,updated_at)
        VALUES ('project-a','A','A','2026-11-22T09:00:00.000Z','2026-11-22T09:00:00.000Z'),
        ('project-b','B','B','2026-11-22T09:00:00.000Z','2026-11-22T09:00:00.000Z');
        INSERT INTO recovery_points SELECT p.id,h,'2026-11-22T09:00:00.123Z'
          FROM projects p CROSS JOIN unnest(ARRAY[1,12,24]) h;
        INSERT INTO recovery_point_owners
          SELECT 'project-a',h,'extension-' || lpad(n::text,3,'0'),9007199254740000+n,
          decode(CASE WHEN n%2=0 THEN '0001ff00' ELSE '' END,'hex'),decode('ff000280','hex')
          FROM generate_series(0,202) n CROSS JOIN unnest(ARRAY[1,12,24]) h;
        INSERT INTO recovery_point_owners SELECT 'project-b',hours,extension_id,revision,records,metadata
          FROM recovery_point_owners WHERE extension_id='extension-000';`);
      if (interruption === "large")
        await previous.pglite.query(
          `UPDATE recovery_point_owners SET records=$1
          WHERE workbench_id='project-a' AND hours=1 AND extension_id='extension-000'`,
          [new Uint8Array(5 * 1024 * 1024).fill(0xa5)],
        );
      const original = (
        await previous.pglite.query<ReleasedRecoveryRow>(`SELECT * FROM recovery_point_owners
        ORDER BY workbench_id,hours,extension_id`)
      ).rows;
      const captures = (
        await previous.pglite.query<{ workbench_id: string; hours: number; captured_at: string }>(
          "SELECT * FROM recovery_points ORDER BY workbench_id,hours",
        )
      ).rows;
      if (interruption === "schema" || interruption === "restore") {
        const finish = await prepareRecoveryOwnerUpgrade(previous.db, previous.path);
        expect((await previous.pglite.query("SELECT * FROM recovery_point_owners")).rows).toEqual([]);
        await migrate(previous.db, { migrationsFolder: join(import.meta.dirname, "../../drizzle-0.46") });
        if (interruption === "restore") {
          await previous.pglite.exec(`CREATE FUNCTION stop_recovery_restore() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN IF EXISTS (SELECT 1 FROM owners WHERE id=NEW.owner_id AND extension_id='extension-202')
            THEN RAISE EXCEPTION 'stop recovery restoration'; END IF; RETURN NEW; END $$;
            CREATE TRIGGER stop_recovery_restore BEFORE INSERT ON recovery_point_owners
              FOR EACH ROW EXECUTE FUNCTION stop_recovery_restore()`);
          await expect(finish!()).rejects.toThrow("Failed query");
          expect(
            (await previous.pglite.query("SELECT count(*)::int AS count FROM recovery_point_owners")).rows,
          ).toEqual([{ count: 200 }]);
          expect(
            (await readFile(`${previous.path}-recovery-owners-upgrade.jsonl`, "utf8")).trim().split("\n"),
          ).toHaveLength(612);
          await previous.pglite.exec("DROP TRIGGER stop_recovery_restore ON recovery_point_owners");
        }
      }
      await previous.close();
      previousClosed = true;
      store = await createDb({ path: previous.path });
      const restored = async () => {
        const { rows } = await store!.pglite.query<{
          workbench_id: string;
          hours: number;
          extension_id: string;
          revision: number;
          sha256: string;
          bytes: number;
        }>(`SELECT r.project_id AS workbench_id,r.hours,o.extension_id,r.revision,r.sha256,r.bytes
          FROM recovery_point_owners r JOIN owners o ON r.owner_id=o.id
          ORDER BY r.project_id,r.hours,o.extension_id`);
        const content = [];
        for (const row of rows) {
          const { sha256, bytes, ...owner } = row;
          const payload = await recoveryFilesFor(store!.db).read(row.workbench_id, row.hours, { sha256, bytes });
          content.push({
            ...owner,
            records: new Uint8Array(payload.records),
            metadata: new Uint8Array(payload.metadata),
          });
        }
        return content;
      };
      expect(await restored()).toEqual(original);
      expect(
        await store.db
          .select({
            workbench_id: recovery_points.project_id,
            hours: recovery_points.hours,
            captured_at: recovery_points.captured_at,
          })
          .from(recovery_points)
          .orderBy(recovery_points.project_id, recovery_points.hours),
      ).toEqual(captures);
      const archives = (await readdir(`${previous.path}-migration-exports`)).filter((name) =>
        name.startsWith("recovery-owners-files-"),
      );
      expect(archives).toHaveLength(1);
      const archive = (await readFile(join(`${previous.path}-migration-exports`, archives[0]!), "utf8"))
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      expect(archive).toHaveLength(612);
      expect(archive[0]!.records).toBe(interruption === "large" ? `\\x${"a5".repeat(5 * 1024 * 1024)}` : "\\x0001ff00");
      expect(archive[1]!.records).toBe("\\x");
      await store.close();
      store = await createDb({ path: previous.path });
      expect(await restored()).toEqual(original);
      expect(await Bun.file(`${previous.path}-recovery-owners-upgrade.jsonl`).exists()).toBe(false);
      await store.pglite.exec("DELETE FROM projects WHERE id='project-a'");
      expect((await store.pglite.query("SELECT count(*)::int AS count FROM recovery_point_owners")).rows).toEqual([
        { count: 3 },
      ]);
      expect((await store.pglite.query("SELECT project_id FROM recovery_points")).rows).toEqual(
        Array.from({ length: 3 }, () => ({ project_id: "project-b" })),
      );
    } finally {
      if (!previousClosed) await previous.close();
      await store?.close();
      await rm(root, { recursive: true, force: true });
    }
  }, 15_000);
