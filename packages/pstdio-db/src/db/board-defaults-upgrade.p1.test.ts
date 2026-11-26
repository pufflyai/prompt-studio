import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/pglite/migrator";
import { createBoardViewsDBService } from "../services/board-views/board-views";
import { createExtensionInstancesDBService } from "../services/extension-instances/extension-instances";
import { createInstalledExtensionSourcesDBService } from "../services/installed-extension-sources/installed-extension-sources";
import { createProjectsDBService } from "../services/projects/projects";
import { prepareBoardDefaultsUpgrade } from "./board-defaults-upgrade";
import { createDb } from "./connection.pglite";
import { restoreReleasedPreferenceTables } from "./preference-upgrade.fixture";
import { prepareProjectExtensionsUpgrade } from "./project-extensions-upgrade";
import { board_views } from "./schemas/board-views";

for (const interrupted of [false, true])
  test(`released saved and builtin board defaults survive ${interrupted ? "interruption after schema commit" : "upgrade and reopen"}`, async () => {
    const root = await mkdtemp(join(tmpdir(), "board-defaults-upgrade-"));
    const path = join(root, "database");
    let store: Awaited<ReturnType<typeof createDb>> | undefined;
    try {
      store = await createDb({ path });
      const project = await createProjectsDBService(store.db).create({ name: "Released boards" });
      const source = await createInstalledExtensionSourcesDBService(store.db).register({
        install_name: "boards",
        extension_id: "example.boards",
        display_name: "Boards",
        source_kind: "local_path",
        source_path: "/boards",
      });
      const instance = await createExtensionInstancesDBService(store.db).create({
        installed_extension_id: source.id,
        scope_type: "project",
        scope_id: project.id,
      });
      const scope = { project_id: project.id, extension_id: null, board_id: "native" };
      const views = createBoardViewsDBService(store.db);
      const view = await views.create({
        ...scope,
        title: "Custom default 日本語",
        settings: { viewMode: "board", columnGrouping: "status", rowGrouping: "none", displayProperties: [] },
        filter: { conjunction: "and", rules: [] },
        sorts: [],
      });
      const stamp = "2026-11-20T12:00:00.000Z";
      await restoreReleasedPreferenceTables(store);
      await store.pglite.query(
        "INSERT INTO board_default_views VALUES ($1, NULL, 'native', $2, $3), ($1, $4, 'native', 'builtin', $3)",
        [project.id, view.id, stamp, instance.id],
      );
      // Cross a capture metadata page with null instance IDs: null tuple keys must
      // not silently exclude native defaults or loop at the page boundary.
      await store.pglite.query(
        "INSERT INTO board_default_views SELECT $1, NULL, 'board-' || n, 'builtin-' || n, $2 FROM generate_series(1, 201) n",
        [project.id, stamp],
      );
      if (interrupted) {
        await prepareBoardDefaultsUpgrade(store.db, path);
        await prepareProjectExtensionsUpgrade(store.db, store.path);
        await migrate(store.db, { migrationsFolder: join(import.meta.dirname, "../../drizzle-0.46") });
      }
      await store.close();
      store = await createDb({ path });
      const migrated = createBoardViewsDBService(store.db);
      expect(await migrated.getDefault(scope)).toEqual({ ...scope, default_view_id: view.id, updated_at: stamp });
      expect(await migrated.getDefault({ ...scope, extension_id: source.extension_id })).toEqual({
        ...scope,
        extension_id: source.extension_id,
        default_view_id: "builtin",
        updated_at: stamp,
      });
      expect(await migrated.listDefaults(project.id)).toHaveLength(203);
      const [saved] = await store.db.select().from(board_views).where(eq(board_views.id, view.id));
      const { is_default, ...original } = saved;
      expect(is_default).toBe(true);
      const { is_default: _before, ...expected } = view;
      expect(original).toEqual(expected);
      await store.close();
      store = await createDb({ path });
      expect(await createBoardViewsDBService(store.db).getDefault(scope)).toMatchObject({
        default_view_id: view.id,
        updated_at: stamp,
      });
    } finally {
      await store?.close();
      await rm(root, { recursive: true, force: true });
    }
  }, 15_000);
