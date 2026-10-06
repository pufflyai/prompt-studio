import { afterAll, describe, expect, test } from "bun:test";
import type { DbClient } from "pstdio-db";
import {
  createBoardViewsDBService,
  createDb,
  createExtensionInstancesDBService,
  createInstalledExtensionSourcesDBService,
  createNotificationsDBService,
  createProjectsDBService,
} from "pstdio-db";
import { createSyncService, SYNCED_TABLES } from "./sync-service";

let close: () => Promise<void>;
let db: DbClient;

const setup = async () => {
  const result = await createDb({ path: ":memory:" });
  close = result.close;
  db = result.db;
};

afterAll(async () => {
  await close?.();
});

describe("createSyncService", () => {
  describe("getFullState", () => {
    test("returns all synced tables as keys", async () => {
      await setup();
      const syncService = createSyncService({ db });
      const state = await syncService.getFullState();

      for (const table of SYNCED_TABLES) {
        expect(state).toHaveProperty(table);
        expect(Array.isArray(state[table])).toBe(true);
      }
    });

    test("returns empty arrays for fresh database", async () => {
      await setup();
      const syncService = createSyncService({ db });
      const state = await syncService.getFullState();

      for (const table of SYNCED_TABLES) {
        expect(state[table]).toHaveLength(0);
      }
    });

    test("returns inserted data", async () => {
      await setup();
      const syncService = createSyncService({ db });

      const projectsService = createProjectsDBService(db);

      await projectsService.create({ name: "test-project" });

      const state = await syncService.getFullState();

      expect(state.projects).toHaveLength(1);
      expect((state.projects[0] as Record<string, unknown>).name).toBe("test-project");
    });

    test("includes installed extension sources and project instances", async () => {
      await setup();
      const syncService = createSyncService({ db });
      const projectsService = createProjectsDBService(db);
      const sourcesService = createInstalledExtensionSourcesDBService(db);
      const instancesService = createExtensionInstancesDBService(db);

      const project = await projectsService.create({ name: "extension-sync-test" });
      const source = await sourcesService.register({
        install_name: "lab",
        extension_id: "pstdio.lab",
        display_name: "Lab",
        source_kind: "local_path",
        source_path: "/extensions/lab",
        status: "loaded",
      });
      const instance = await instancesService.create({
        installed_extension_id: source.id,
        scope_id: project.id,
        scope_type: "project",
      });

      const state = await syncService.getFullState();

      expect(state.installed_extension_sources).toContainEqual(expect.objectContaining({ id: source.id }));
      expect(state.extension_instances).toContainEqual(expect.objectContaining({ id: instance.id }));
    });

    test("excludes soft-deleted rows", async () => {
      await setup();
      const syncService = createSyncService({ db });

      const projectsService = createProjectsDBService(db);
      const project = await projectsService.create({ name: "soft-delete-test" });

      await projectsService.remove(project.id);
      const state = await syncService.getFullState();
      const syncedProjects = state.projects as { id: string }[];

      expect(syncedProjects.find((item) => item.id === project.id)).toBeUndefined();
    });
  });

  describe("cascadeDeletes", () => {
    test("lists project dependents before the project", async () => {
      await setup();
      const syncService = createSyncService({ db });
      const project = await createProjectsDBService(db).create({ name: "cascade-test" });
      const notification = await createNotificationsDBService(db).create({
        project_id: project.id,
        source: "core",
        origin: "system",
        title: "Needs review",
        kind: "needs_review",
      });

      const deletes = await syncService.cascadeDeletes("projects", project.id);

      expect(deletes).toContainEqual({ table: "notifications", id: notification.id });
      expect(deletes.at(-1)).toEqual({ table: "projects", id: project.id });
    });

    test("lists nothing for a missing row", async () => {
      await setup();
      const syncService = createSyncService({ db });

      expect(await syncService.cascadeDeletes("projects", "non-existent-id")).toEqual([]);
    });
  });
});

test("snapshots shared board views and lists their project cascade deletions", async () => {
  await setup();
  const project = await createProjectsDBService(db).create({ name: "Shared snapshot" });
  const source = await createInstalledExtensionSourcesDBService(db).register({
    install_name: "boards",
    extension_id: "test.boards",
    display_name: "Boards",
    source_kind: "local_path",
    source_path: "/snapshot-boards",
  });
  const instance = await createExtensionInstancesDBService(db).create({
    installed_extension_id: source.id,
    scope_type: "project",
    scope_id: project.id,
  });
  const scope = { project_id: project.id, extension_instance_id: instance.id, board_id: "tasks" };
  const views = createBoardViewsDBService(db);
  const view = await views.create({
    ...scope,
    title: "Shared",
    settings: {
      viewMode: "board",
      columnGrouping: "none",
      rowGrouping: "none",
      displayProperties: [],
    },
    filter: { conjunction: "and", rules: [] },
    sorts: [],
  });
  await views.setDefault(scope, view.id);
  const sync = createSyncService({ db });
  const state = await sync.getFullState();
  const defaultId = JSON.stringify([project.id, instance.id, "tasks"]);
  expect(state.board_views).toContainEqual(expect.objectContaining({ id: view.id }));
  expect(state.board_default_views).toContainEqual(
    expect.objectContaining({ id: defaultId, default_view_id: view.id }),
  );
  const deletes = await sync.cascadeDeletes("projects", project.id);
  expect(deletes).toContainEqual({ table: "board_views", id: view.id });
  expect(deletes).toContainEqual({ table: "board_default_views", id: defaultId });
});
