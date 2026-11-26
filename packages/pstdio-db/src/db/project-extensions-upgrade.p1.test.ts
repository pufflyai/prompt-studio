import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/pglite/migrator";
import { createExtensionInstancesDBService } from "../services/extension-instances/extension-instances";
import type { ExtensionInstanceRow } from "../services/extension-instances/project-extension-row";
import { createInstalledExtensionSourcesDBService } from "../services/installed-extension-sources/installed-extension-sources";
import { createDb } from "./connection.pglite";
import { restoreReleasedPreferenceTables } from "./preference-upgrade.fixture";
import { prepareProjectExtensionsUpgrade } from "./project-extensions-upgrade";

for (const interruption of ["normal", "schema", "restore"])
  test(`released extension configuration survives ${interruption} upgrade with exact original exports`, async () => {
    const root = await mkdtemp(join(tmpdir(), "project-extension-upgrade-"));
    const path = join(root, "database");
    let store: Awaited<ReturnType<typeof createDb>> | undefined;
    try {
      store = await createDb({ path });
      const source = await createInstalledExtensionSourcesDBService(store.db).register({
        install_name: "configuration",
        extension_id: "example.configuration",
        display_name: "Configuration",
        source_kind: "local_path",
        source_path: "/configuration",
      });
      await store.pglite.exec(
        "INSERT INTO projects (id,name,shorthand,created_at,updated_at) SELECT 'project-' || n,'Project ' || n,'P' || n,'2026-11-20T12:00:00.000Z','2026-11-20T12:00:00.000Z' FROM generate_series(0,200) n",
      );
      await restoreReleasedPreferenceTables(store);
      await store.pglite.query(
        `INSERT INTO extension_instances
        (id,installed_extension_id,scope_type,scope_id,display_name_override,enabled,config_json,diagnostics_json,created_at,updated_at)
        SELECT 'legacy-' || n,$1,'project','project-' || n,'Saved ' || n,n % 2 = 0,jsonb_build_object('value',n),jsonb_build_object('diagnostic',n),'2026-11-19T12:00:00.000Z','2026-11-20T12:00:00.000Z' FROM generate_series(0,200) n`,
        [source.id],
      );
      const large = { text: "x".repeat(5 * 1024 * 1024), unicode: "åäö 日本語 😀" };
      await store.pglite.query("UPDATE extension_instances SET config_json=$1 WHERE id='legacy-100'", [
        JSON.stringify(large),
      ]);
      for (const [id, scope, target] of [
        ["non-project", "user", "user-1"],
        ["orphan", "project", "missing"],
      ])
        await store.pglite.query(
          "INSERT INTO extension_instances (id,installed_extension_id,scope_type,scope_id,enabled,config_json,created_at,updated_at) VALUES ($1,$2,$3,$4,false,$5,'2026-11-19T12:00:00.000Z','2026-11-20T12:00:00.000Z')",
          [id, source.id, scope, target, JSON.stringify({ saved: id })],
        );
      const originals = (
        await store.pglite.query<ExtensionInstanceRow>("SELECT * FROM extension_instances ORDER BY id")
      ).rows;
      if (interruption !== "normal") {
        const finish = await prepareProjectExtensionsUpgrade(store.db, store.path);
        await migrate(store.db, { migrationsFolder: join(import.meta.dirname, "../../drizzle-0.46") });
        if (interruption === "restore") {
          await store.pglite.exec(
            "CREATE FUNCTION stop_project_extension_restore() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.project_id='project-100' THEN RAISE EXCEPTION 'stop restoration'; END IF; RETURN NEW; END $$; CREATE TRIGGER stop_project_extension_restore BEFORE INSERT ON project_extensions FOR EACH ROW EXECUTE FUNCTION stop_project_extension_restore()",
          );
          await expect(finish!()).rejects.toThrow("Failed query");
          expect(await Bun.file(`${path}-project-extensions-upgrade.jsonl`).exists()).toBe(true);
          await store.pglite.exec("DROP TRIGGER stop_project_extension_restore ON project_extensions");
        }
      }
      await store.close();
      store = await createDb({ path });
      const instances = await createExtensionInstancesDBService(store.db).list();
      expect(instances).toHaveLength(201);
      for (const original of originals.filter((row) => row.scope_id.startsWith("project-"))) {
        const migrated = instances.find((row) => row.scope_id === original.scope_id)!;
        expect({ ...migrated, id: original.id }).toEqual(original);
      }
      const archive = (await readFile(`${path}-migration-exports/extension-instances.jsonl`, "utf8"))
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      expect(archive.map((row) => row.released)).toEqual(originals);
      expect(archive.filter((row) => row.project === null).map((row) => row.released.id)).toEqual([
        "non-project",
        "orphan",
      ]);
      await store.close();
      store = await createDb({ path });
      expect(await createExtensionInstancesDBService(store.db).list()).toEqual(instances);
    } finally {
      await store?.close();
      await rm(root, { recursive: true, force: true });
    }
  });
