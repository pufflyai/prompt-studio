import { describe, expect, onTestFinished, test } from "bun:test";
import type { DbClient } from "pstdio-db";
import {
  createBoardViewsDBService,
  createDb,
  createExtensionInstancesDBService,
  createInstalledExtensionSourcesDBService,
  createNotificationsDBService,
  createProjectsDBService,
} from "pstdio-db";
import { createSyncService } from "./sync-service";

let db: DbClient;

const setup = async () => {
  const result = await createDb({ path: ":memory:" });
  onTestFinished(result.close);
  db = result.db;
};

describe("createSyncService", () => {
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
