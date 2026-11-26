import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { migrate } from "drizzle-orm/pglite/migrator";
import { createArtifactFileProjectionsDBService } from "../services/extension-storage/artifact-file-projections";
import { prepareArtifactProjectionUpgrade } from "./artifact-projection-upgrade";
import { createDb } from "./connection.pglite";
import { createTextLogOwnerFixture } from "./log-owner-upgrade.fixture";

const owner = { workbenchId: "project", extensionId: "example.artifacts" };
const projectionKey = (root: string) =>
  createHash("sha256")
    .update(JSON.stringify([owner, resolve(root, ".pstdio/extension-storage", owner.extensionId)]))
    .digest("hex");
const state = { node: null, hash: null, revision: "saved åäö 日本語 😀" };
const tables = ["artifact_file_projection_roots", "artifact_file_projections"];

for (const interruption of ["normal", "schema", "restore"])
  test(`artifact file facts and opaque orphan roots survive ${interruption} upgrade`, async () => {
    const root = await mkdtemp(join(tmpdir(), "artifact-owner-upgrade-"));
    const previous = await createTextLogOwnerFixture(root);
    let closed = false;
    let store: Awaited<ReturnType<typeof createDb>> | undefined;
    try {
      await previous.pglite.exec(`
        INSERT INTO projects (id,name,shorthand,created_at,updated_at) VALUES ('project','Project','P','2026-11-22','2026-11-22');
        INSERT INTO extensions (id,install_name,extension_id,display_name,source_kind,source_path,created_at,updated_at)
          VALUES ('source','artifacts','example.artifacts','Artifacts','local_path','/extension','2026-11-22','2026-11-22');
        INSERT INTO project_extensions (project_id,extension_ref,created_at,updated_at) VALUES ('project','source','2026-11-22','2026-11-22');
        INSERT INTO workspaces (id,project_id,name,root_path,workspace_shorthand,execution_kind,created_at,updated_at)
          VALUES ('known','project','Known','/known','WS-1','local','2026-11-22','2026-11-22'),
                 ('empty','project','Empty','/empty','WS-2','local','2026-11-22','2026-11-22'),
                 ('remote','project','Remote','/remote','WS-3','remote','2026-11-22','2026-11-22');`);
      for (const folder of ["/known", "/empty", "/removed", "/remote"]) {
        const key = projectionKey(folder);
        await previous.pglite.query("INSERT INTO artifact_file_projection_roots VALUES ($1)", [key]);
        if (folder !== "/empty")
          await previous.pglite.query("INSERT INTO artifact_file_projections VALUES ($1,$2,$3)", [
            key,
            "notes/one.md",
            JSON.stringify(state),
          ]);
      }
      const originals = await Promise.all(
        tables.map(
          async (table) => (await previous.pglite.query(`SELECT * FROM ${table} ORDER BY projection_key`)).rows,
        ),
      );
      if (interruption !== "normal") {
        const finish = await prepareArtifactProjectionUpgrade(previous.db, previous.path);
        await migrate(previous.db, { migrationsFolder: join(import.meta.dirname, "../../drizzle-0.46") });
        if (interruption === "restore") {
          await previous.pglite.exec(`CREATE FUNCTION stop_artifact_restore() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
            IF NEW.path='notes/one.md' THEN RAISE EXCEPTION 'stop artifact restoration'; END IF; RETURN NEW; END $$;
            CREATE TRIGGER stop_artifact_restore BEFORE INSERT ON file_projections FOR EACH ROW EXECUTE FUNCTION stop_artifact_restore()`);
          await expect(finish!()).rejects.toThrow("Failed query");
          for (const table of tables)
            expect(await Bun.file(`${previous.path}-${table}-owned-upgrade.jsonl`).exists()).toBe(true);
          await previous.pglite.exec("DROP TRIGGER stop_artifact_restore ON file_projections");
        }
      }
      await previous.close();
      closed = true;
      store = await createDb({ path: previous.path });
      const verify = async () => {
        const service = createArtifactFileProjectionsDBService(store!.db);
        expect(await service.open(projectionKey("/known"), owner).read()).toEqual({
          initialized: true,
          state: { "notes/one.md": state },
        });
        expect(await service.open(projectionKey("/empty"), owner).read()).toEqual({ initialized: true, state: {} });
        for (const folder of ["/removed", "/remote"]) {
          const unavailable = service.open(projectionKey(folder), owner);
          await expect(unavailable.read()).rejects.toThrow("retained");
          await expect(unavailable.write({ "notes/one.md": state })).rejects.toThrow("retained");
          await expect(unavailable.initialize({})).rejects.toThrow("retained");
        }
        expect(await service.open(projectionKey("/new"), owner).read()).toEqual({ initialized: false, state: {} });
        expect(
          (await store!.pglite.query("SELECT o.extension_id FROM file_projections f JOIN owners o ON o.id=f.owner_id"))
            .rows,
        ).toEqual(Array.from({ length: 3 }, () => ({ extension_id: owner.extensionId })));
      };
      await verify();
      for (const [index, table] of tables.entries()) {
        const exported = (await readFile(`${previous.path}-migration-exports/${table}.jsonl`, "utf8"))
          .trim()
          .split("\n")
          .map((line) => JSON.parse(line));
        expect(exported).toEqual(originals[index]);
        expect(await Bun.file(`${previous.path}-${table}-owned-upgrade.jsonl`).exists()).toBe(false);
      }
      await store.close();
      store = await createDb({ path: previous.path });
      await verify();
    } finally {
      if (!closed) await previous.close();
      await store?.close();
      await rm(root, { recursive: true, force: true });
    }
  });
