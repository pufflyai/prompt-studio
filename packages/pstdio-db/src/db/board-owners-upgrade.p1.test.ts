import { expect, test } from "bun:test";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/pglite/migrator";
import { createBoardViewsDBService } from "../services/board-views/board-views";
import { createExtensionInstancesDBService } from "../services/extension-instances/extension-instances";
import { createInstalledExtensionSourcesDBService } from "../services/installed-extension-sources/installed-extension-sources";
import { createProjectsDBService } from "../services/projects/projects";
import { prepareBoardDefaultsUpgrade } from "./board-defaults-upgrade";
import { prepareBoardOwnersUpgrade } from "./board-owners-upgrade";
import { createDb } from "./connection.pglite";
import { restoreReleasedPreferenceTables } from "./preference-upgrade.fixture";
import { board_views } from "./schemas.pg";

type ReleasedBoard = Omit<typeof board_views.$inferSelect, "extension_id" | "is_default"> & {
  extension_instance_id: string | null;
};
type ReleasedDefault = {
  project_id: string;
  extension_instance_id: string | null;
  board_id: string;
  default_view_id: string;
  updated_at: string;
};

for (const interrupted of [false, true])
  test(`released board owners and merged defaults survive ${interrupted ? "schema interruption" : "upgrade"}`, async () => {
    const root = await mkdtemp(join(tmpdir(), "board-owners-upgrade-"));
    const path = join(root, "database");
    let store: Awaited<ReturnType<typeof createDb>> | undefined;
    try {
      store = await createDb({ path });
      const project = await createProjectsDBService(store.db).create({ name: "Original boards" });
      const instances = [];
      for (const suffix of ["a", "b"]) {
        const source = await createInstalledExtensionSourcesDBService(store.db).register({
          install_name: `boards-${suffix}`,
          extension_id: "example.boards",
          display_name: "Boards",
          source_kind: "local_path",
          source_path: `/boards-${suffix}`,
        });
        instances.push(
          await createExtensionInstancesDBService(store.db).create({
            installed_extension_id: source.id,
            scope_type: "project",
            scope_id: project.id,
          }),
        );
      }
      const stamp = "2026-10-01T00:00:00.000Z";
      const view = (id: string, extension_id: string | null) => ({
        id,
        project_id: project.id,
        extension_id,
        board_id: extension_id ? "tasks" : "native",
        title: `Custom ${id} 日本語`,
        settings: { viewMode: "board" as const, columnGrouping: "none", rowGrouping: "none", displayProperties: [] },
        filter: { conjunction: "and" as const, rules: [] },
        sorts: [],
        sort_order: 0,
        created_at: stamp,
        updated_at: stamp,
      });
      await store.db
        .insert(board_views)
        .values([
          ...Array.from({ length: 201 }, (_, i) => view(`native-${i}`, null)),
          view("custom-a", "example.boards"),
          view("custom-b", "example.boards"),
        ]);
      await restoreReleasedPreferenceTables(store);
      await store.pglite.query("UPDATE board_views SET extension_instance_id = $1 WHERE id='custom-a'", [
        instances[0].id,
      ]);
      await store.pglite.query("UPDATE board_views SET extension_instance_id = $1 WHERE id='custom-b'", [
        instances[1].id,
      ]);
      const selectedAt = "2026-11-20T00:00:00.000Z";
      await store.pglite.query(
        "INSERT INTO board_default_views VALUES ($1,NULL,'native','native-200',$4),($1,$2,'tasks','custom-a',$4),($1,$3,'tasks','custom-b',$5)",
        [project.id, instances[0].id, instances[1].id, stamp, selectedAt],
      );
      const original = (await store.pglite.query<ReleasedBoard>("SELECT * FROM board_views ORDER BY id")).rows;
      const defaults = (
        await store.pglite.query<ReleasedDefault>(
          "SELECT * FROM board_default_views ORDER BY project_id, extension_instance_id NULLS FIRST, board_id",
        )
      ).rows;
      if (interrupted) {
        await prepareBoardOwnersUpgrade(store.db, path);
        await prepareBoardDefaultsUpgrade(store.db, path);
        await migrate(store.db, { migrationsFolder: join(import.meta.dirname, "../../drizzle") });
      }
      await store.close();
      store = await createDb({ path });
      const service = createBoardViewsDBService(store.db);
      const extension = { project_id: project.id, extension_id: "example.boards", board_id: "tasks" };
      expect((await service.list(extension)).map((row) => row.id).sort()).toEqual(["custom-a", "custom-b"]);
      expect(await service.getDefault(extension)).toEqual({
        ...extension,
        default_view_id: "custom-b",
        updated_at: selectedAt,
      });
      expect(await service.getDefault({ ...extension, extension_id: null, board_id: "native" })).toMatchObject({
        default_view_id: "native-200",
        updated_at: stamp,
      });
      for (const row of original) {
        const { extension_instance_id, ...fields } = row;
        expect(await service.get(project.id, row.id)).toEqual({
          ...fields,
          extension_id: extension_instance_id ? "example.boards" : null,
          is_default: ["custom-b", "native-200"].includes(row.id),
        });
      }
      const archive = `${path}-migration-exports/board-owners.jsonl`;
      const owners = (await Bun.file(archive).text())
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      expect(owners.map(({ extension_id, ...row }) => row)).toEqual(original);
      const archivedDefaults = (await Bun.file(`${path}-migration-exports/board-defaults.jsonl`).text())
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      expect(archivedDefaults.map(({ extension_id, ...row }) => row)).toEqual(defaults);
      const mtime = (await stat(archive)).mtimeMs;
      await store.close();
      store = await createDb({ path });
      expect(await createBoardViewsDBService(store.db).getDefault(extension)).toEqual({
        ...extension,
        default_view_id: "custom-b",
        updated_at: selectedAt,
      });
      expect((await stat(archive)).mtimeMs).toBe(mtime);
    } finally {
      await store?.close();
      await rm(root, { recursive: true, force: true });
    }
  });

test("a foreign-project legacy board reference is refused without changing its source row", async () => {
  const root = await mkdtemp(join(tmpdir(), "foreign-board-owner-"));
  const store = await createDb({ path: join(root, "database") });
  try {
    const projects = createProjectsDBService(store.db);
    const project = await projects.create({ name: "Board owner" });
    const foreign = await projects.create({ name: "Foreign provider" });
    const source = await createInstalledExtensionSourcesDBService(store.db).register({
      install_name: "foreign-boards",
      extension_id: "example.boards",
      display_name: "Boards",
      source_kind: "local_path",
      source_path: "/foreign-boards",
    });
    const instance = await createExtensionInstancesDBService(store.db).create({
      installed_extension_id: source.id,
      scope_type: "project",
      scope_id: foreign.id,
    });
    await createBoardViewsDBService(store.db).create({
      project_id: project.id,
      extension_id: null,
      board_id: "tasks",
      title: "Private view",
      settings: { viewMode: "board", columnGrouping: "none", rowGrouping: "none", displayProperties: [] },
      filter: { conjunction: "and", rules: [] },
      sorts: [],
    });
    await restoreReleasedPreferenceTables(store);
    await store.pglite.query("UPDATE board_views SET extension_instance_id = $1 WHERE project_id=$2", [
      instance.id,
      project.id,
    ]);
    const original = (await store.pglite.query("SELECT * FROM board_views")).rows;
    await expect(prepareBoardOwnersUpgrade(store.db, store.path)).rejects.toThrow("does not belong to project");
    expect((await store.pglite.query("SELECT * FROM board_views")).rows).toEqual(original);
  } finally {
    await store.close();
    await rm(root, { recursive: true, force: true });
  }
});
