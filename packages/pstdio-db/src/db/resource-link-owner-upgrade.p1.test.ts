import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/pglite/migrator";
import { createResourceLinksDBService } from "../services/resource-links";
import { createDb } from "./connection.pglite";
import { createTextLogOwnerFixture } from "./log-owner-upgrade.fixture";
import { prepareResourceLinkOwnerUpgrade } from "./resource-link-owner-upgrade";

for (const interruption of ["normal", "schema", "restore"])
  test(`resource links retain endpoints, roles and metadata after ${interruption} owner upgrade`, async () => {
    const root = await mkdtemp(join(tmpdir(), "resource-link-owner-upgrade-"));
    const previous = await createTextLogOwnerFixture(root);
    let previousClosed = false;
    let store: Awaited<ReturnType<typeof createDb>> | undefined;
    try {
      await previous.pglite.exec(`INSERT INTO projects (id,name,shorthand,created_at,updated_at)
        VALUES ('project-a','A','A','2026-11-20T12:00:00.000Z','2026-11-20T12:00:00.000Z'),
        ('project-b','B','B','2026-11-20T12:00:00.000Z','2026-11-20T12:00:00.000Z');
        INSERT INTO resource_anchors
        SELECT 'project-a','example.notes','item','source-' || lpad(n::text,3,'0'),
          'example.art','item','same',CASE WHEN n%2=0 THEN 'result' ELSE 'context' END,
          jsonb_build_object('type','item','id','same','label','Saved 日本語 🦉','metadata',jsonb_build_object('revision',n),
            'sourceRef',jsonb_build_object('label','Source ' || n)) FROM generate_series(0,202) n;
        INSERT INTO resource_anchors SELECT 'project-b',source_owner,source_kind,source_id,target_owner,target_kind,target_id,role,details
          FROM resource_anchors WHERE source_id='source-000';
        INSERT INTO resource_anchors SELECT project_id,target_owner,target_kind,target_id,source_owner,source_kind,source_id,role,details
          FROM resource_anchors WHERE project_id='project-a' AND source_id='source-000';`);
      const order = "project_id,source_owner,source_kind,source_id,target_owner,target_kind,target_id";
      const original = (await previous.pglite.query(`SELECT * FROM resource_anchors ORDER BY ${order}`)).rows;
      if (interruption !== "normal") {
        const finish = await prepareResourceLinkOwnerUpgrade(previous.db, previous.path);
        await migrate(previous.db, { migrationsFolder: join(import.meta.dirname, "../../drizzle-0.46") });
        if (interruption === "restore") {
          await previous.pglite.exec(`CREATE FUNCTION stop_link_restore() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN IF NEW.source_id='source-201' THEN RAISE EXCEPTION 'stop restoration'; END IF; RETURN NEW; END $$;
            CREATE TRIGGER stop_link_restore BEFORE INSERT ON resource_links FOR EACH ROW EXECUTE FUNCTION stop_link_restore()`);
          await expect(finish!()).rejects.toThrow("Failed query");
          expect(
            (await previous.pglite.query<{ n: number }>("SELECT count(*)::int AS n FROM resource_links")).rows[0]!.n,
          ).toBe(200);
          const input = (await readFile(`${previous.path}-resource-link-owners-upgrade.jsonl`, "utf8"))
            .trim()
            .split("\n")
            .map((line) => JSON.parse(line));
          expect(input).toEqual(original);
          await previous.pglite.exec("DROP TRIGGER stop_link_restore ON resource_links");
        }
      }
      await previous.close();
      previousClosed = true;
      store = await createDb({ path: previous.path });
      const restored = async () =>
        (
          await store!.pglite.query(`SELECT s.project_id,s.extension_id AS source_owner,
        l.source_kind,l.source_id,t.extension_id AS target_owner,l.target_kind,l.target_id,l.role,l.details
        FROM resource_links l JOIN owners s ON l.source_owner=s.id JOIN owners t ON l.target_owner=t.id ORDER BY ${order}`)
        ).rows;
      expect(await restored()).toEqual(original);
      const links = createResourceLinksDBService(store.db);
      const source = { projectId: "project-a", extensionId: "example.notes", type: "item", id: "source-000" };
      const outgoing = (await links.list({ resource: source })).items;
      expect(outgoing[0]?.target.metadata).toEqual({ revision: 0 });
      expect(outgoing[0]?.target.role).toBe("result");
      expect((await links.list({ resource: source, direction: "incoming" })).items).toHaveLength(1);
      expect((await links.list({ resource: { ...source, projectId: "project-b" } })).items).toHaveLength(1);
      const archive = (await readFile(`${previous.path}-migration-exports/resource-links.jsonl`, "utf8"))
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      expect(archive).toEqual(original);
      await store.close();
      store = await createDb({ path: previous.path });
      expect(await restored()).toEqual(original);
      expect(await Bun.file(`${previous.path}-resource-link-owners-upgrade.jsonl`).exists()).toBe(false);
    } finally {
      if (!previousClosed) await previous.close();
      await store?.close();
      await rm(root, { recursive: true, force: true });
    }
  });
