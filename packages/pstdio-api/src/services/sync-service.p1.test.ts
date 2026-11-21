import { describe, expect, onTestFinished, test } from "bun:test";
import { eq } from "drizzle-orm";
import type { DbClient } from "pstdio-db";
import {
  createBoardViewsDBService,
  createDb,
  createExtensionInstancesDBService,
  createInstalledExtensionSourcesDBService,
  createNotificationsDBService,
  createProjectsDBService,
  createSessionsDBService,
  createWorkspaceSessionsDBService,
  createWorkspacesDBService,
  workspaces,
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
  expect(state.board_views.every((row) => !("is_default" in (row as object)))).toBe(true);
  const native = { project_id: project.id, extension_instance_id: null, board_id: "native" };
  await views.setDefault(native, "builtin");
  const withBuiltin = await sync.getFullState();
  expect(withBuiltin.board_default_views).toContainEqual(
    expect.objectContaining({ id: JSON.stringify([project.id, null, "native"]), default_view_id: "builtin" }),
  );
  const deletes = await sync.cascadeDeletes("projects", project.id);
  expect(deletes).toContainEqual({ table: "board_default_views", id: JSON.stringify([project.id, null, "native"]) });
  expect(deletes).toContainEqual({ table: "board_views", id: view.id });
  expect(deletes).toContainEqual({ table: "board_default_views", id: defaultId });
});

test("workspace link snapshots and deletions follow the session FK without deleting its session", async () => {
  await setup();
  const project = await createProjectsDBService(db).create({ name: "Workspace FK snapshot" });
  const workspace = await createWorkspacesDBService(db).create({ project_id: project.id, shorthand_base: "CURRENT" });
  const sessionService = createSessionsDBService(db);
  const session = await sessionService.create({
    project_id: project.id,
    title: "Retained session",
    agent: "codex",
    status: "completed",
  });
  const link = await createWorkspaceSessionsDBService(db).link(workspace.id, session.id);
  const sync = createSyncService({ db });
  const before = await sync.getFullState();
  expect(before.workspace_sessions).toEqual([link]);
  expect(before.sessions).toContainEqual(session);
  const removedWorkspace = await sync.cascadeDeletes("workspaces", workspace.id);
  expect(removedWorkspace).toContainEqual({ table: "workspace_sessions", id: link.id });
  expect(removedWorkspace).not.toContainEqual({ table: "sessions", id: session.id });
  expect(removedWorkspace.at(-1)).toEqual({ table: "workspaces", id: workspace.id });
  expect(await sync.cascadeDeletes("sessions", session.id)).toContainEqual({
    table: "workspace_sessions",
    id: link.id,
  });
  expect(await sync.cascadeDeletes("projects", project.id)).toContainEqual({
    table: "workspace_sessions",
    id: link.id,
  });
  await db.delete(workspaces).where(eq(workspaces.id, workspace.id));
  const after = await sync.getFullState();
  expect(after.workspace_sessions).toEqual([]);
  expect(after.sessions).toContainEqual(session);
});
