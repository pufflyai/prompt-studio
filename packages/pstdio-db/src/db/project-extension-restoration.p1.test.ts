import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { and, eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/pglite/migrator";
import { createInstalledExtensionSourcesDBService } from "../services/installed-extension-sources/installed-extension-sources";
import { createDb } from "./connection.pglite";
import { restoreReleasedPreferenceTables } from "./preference-upgrade.fixture";
import { prepareProjectExtensionsUpgrade } from "./project-extensions-upgrade";
import { project_extensions } from "./schemas.pg";

test("partial configuration restoration retains its original export and refuses a changed oversized target", async () => {
  const root = await mkdtemp(join(tmpdir(), "project-extension-restoration-"));
  let store: Awaited<ReturnType<typeof createDb>> | undefined;
  try {
    store = await createDb({ path: join(root, "database") });
    const source = await createInstalledExtensionSourcesDBService(store.db).register({
      install_name: "restore",
      extension_id: "example.restore",
      display_name: "Restore",
      source_kind: "local_path",
      source_path: "/restore",
    });
    await store.pglite.exec(`INSERT INTO projects(id,name,shorthand,created_at,updated_at)
      SELECT 'project-'||n,'Project','P'||n,'2026-11-22','2026-11-22' FROM generate_series(0,2)n`);
    await restoreReleasedPreferenceTables(store);
    await store.pglite.query(
      `INSERT INTO extension_instances
      (id,installed_extension_id,scope_type,scope_id,config_json,created_at,updated_at)
      SELECT 'legacy-'||n,$1,'project','project-'||n,jsonb_build_object('saved',n),
        '2026-11-22T09:00:00.000Z','2026-11-22T09:00:00.000Z' FROM generate_series(0,2)n`,
      [source.id],
    );
    const originals = (await store.pglite.query("SELECT * FROM extension_instances ORDER BY id")).rows;
    const finish = await prepareProjectExtensionsUpgrade(store.db, store.path);
    const snapshot = `${store.path}-project-extensions-upgrade.jsonl`;
    const originalExport = await readFile(snapshot, "utf8");
    await migrate(store.db, { migrationsFolder: join(import.meta.dirname, "../../drizzle-0.46") });
    await finish!(true);
    const where = and(eq(project_extensions.project_id, "project-1"), eq(project_extensions.extension_ref, source.id));
    const changed = { text: "x".repeat(5 * 1024 * 1024), unicode: "日本語 😀" };
    await store.db.update(project_extensions).set({ config_json: changed }).where(where);
    await expect(finish!(true)).rejects.toThrow("conflicts with existing configuration");
    expect((await store.db.select().from(project_extensions).where(where))[0]!.config_json).toEqual(changed);
    expect(await readFile(snapshot, "utf8")).toBe(originalExport);
    expect(await Bun.file(`${store.path}-migration-exports/extension-instances.jsonl`).exists()).toBe(false);
    await store.db
      .update(project_extensions)
      .set({ config_json: { saved: 1 } })
      .where(where);
    await finish!();
    expect(await Bun.file(snapshot).exists()).toBe(false);
    const archived = (await readFile(`${store.path}-migration-exports/extension-instances.jsonl`, "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(archived.map((row) => row.released)).toEqual(originals);
    expect(
      (await store.db.select().from(project_extensions).orderBy(project_extensions.project_id)).map(
        (row) => row.config_json,
      ),
    ).toEqual([{ saved: 0 }, { saved: 1 }, { saved: 2 }]);
  } finally {
    await store?.close();
    await rm(root, { recursive: true, force: true });
  }
});
