import { afterEach, beforeEach, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { createDb } from "../../db/connection.pglite";
import { projects } from "../../db/schemas.pg";
import { createExtensionInstancesDBService } from "../extension-instances/extension-instances";
import { createExtensionUserDataDBService } from "../extension-user-data/extension-user-data";
import { createInstalledExtensionSourcesDBService } from "../installed-extension-sources/installed-extension-sources";
import { createProjectsDBService } from "../projects/projects";
import { createBoardViewsDBService } from "./board-views";

let connection: Awaited<ReturnType<typeof createDb>>;
let service: ReturnType<typeof createBoardViewsDBService>;
let scope: { project_id: string; extension_instance_id: string; board_id: string };
const settings = {
  viewMode: "board" as const,
  columnGrouping: "status",
  rowGrouping: "none",
  displayProperties: [],
};
const statusIs = (value: string) => ({
  filter: {
    conjunction: "and" as const,
    rules: [{ attributeId: "status", condition: "is-any-of" as const, value: [value] }],
  },
  sorts: [{ attributeId: "title", direction: "asc" as const }],
});
const unfiltered = { filter: { conjunction: "and" as const, rules: [] }, sorts: [] };

beforeEach(async () => {
  connection = await createDb({ path: ":memory:" });
  service = createBoardViewsDBService(connection.db);
  const project = await createProjectsDBService(connection.db).create({ name: "Boards" });
  const source = await createInstalledExtensionSourcesDBService(connection.db).register({
    install_name: "test.boards",
    extension_id: "test.boards",
    display_name: "Boards",
    source_kind: "local_path",
    source_path: "/boards",
  });
  const instance = await createExtensionInstancesDBService(connection.db).create({
    installed_extension_id: source.id,
    scope_type: "project",
    scope_id: project.id,
  });
  scope = { project_id: project.id, extension_instance_id: instance.id, board_id: "tasks" };
});
afterEach(async () => {
  await connection?.close();
});

test("persists scoped views in order and clears a deleted default atomically", async () => {
  const first = await service.create({ ...scope, title: "First", settings, ...unfiltered });
  const second = await service.create({ ...scope, title: "Second", settings, ...statusIs("todo") });
  await service.reorder(scope, [second.id, first.id]);
  expect((await service.list(scope)).map((row) => row.id)).toEqual([second.id, first.id]);
  await service.setDefault(scope, first.id);
  expect((await service.getDefault(scope))?.default_view_id).toBe(first.id);
  const deleted = await service.remove(scope.project_id, first.id);
  expect(deleted?.view.id).toBe(first.id);
  expect(deleted?.defaultView?.default_view_id).toBe(first.id);
  expect(await service.getDefault(scope)).toBeNull();
  expect(await service.get("another-project", second.id)).toBeNull();
});

test("rejects incomplete ordering without changing any saved order", async () => {
  const first = await service.create({ ...scope, title: "First", settings, ...unfiltered });
  const second = await service.create({ ...scope, title: "Second", settings, ...unfiltered });
  await expect(service.reorder(scope, [second.id])).rejects.toThrow("every saved view exactly once");
  expect((await service.list(scope)).map((row) => row.id)).toEqual([first.id, second.id]);
});

test("treats views and built-in defaults as extension user data and cascades project deletion", async () => {
  const userData = createExtensionUserDataDBService(connection.db);
  await service.setDefault(scope, "builtin");
  expect(await userData.hasUserData(scope.extension_instance_id)).toBe(true);
  await userData.deleteForInstance(scope.extension_instance_id);
  expect(await service.getDefault(scope)).toBeNull();
  await service.create({ ...scope, title: "Shared", settings, ...unfiltered });
  expect(await userData.hasUserData(scope.extension_instance_id)).toBe(true);
  await connection.db.delete(projects).where(eq(projects.id, scope.project_id));
  expect(await service.list(scope)).toEqual([]);
});

test("a cleanup from an older read cannot replace a newer user edit", async () => {
  const original = await service.create({ ...scope, title: "Shared", settings, ...statusIs("old") });
  await service.update(scope.project_id, original.id, { filter: statusIs("new").filter });
  expect(await service.clean(original, { settings, ...unfiltered })).toBeNull();
  expect((await service.get(scope.project_id, original.id))?.filter).toEqual(statusIs("new").filter);
});

test("native views keep one default and survive extension data deletion", async () => {
  const native = { ...scope, extension_instance_id: null, board_id: "dashboard-workbench.workspaces" };
  const first = await service.create({ ...native, title: "Workspaces", settings, ...unfiltered });
  const second = await service.create({ ...native, title: "Release", settings, ...unfiltered });
  await service.setDefault(native, first.id);
  await service.setDefault(native, second.id);
  expect((await service.getDefault(native))?.default_view_id).toBe(second.id);
  await service.create({ ...scope, title: "Extension tasks", settings, ...unfiltered });
  await service.setDefault(scope, "builtin");
  await createExtensionUserDataDBService(connection.db).deleteForInstance(scope.extension_instance_id);
  expect(await service.list(scope)).toEqual([]);
  expect((await service.list(native)).map((view) => view.id)).toEqual([first.id, second.id]);
  expect((await service.getDefault(native))?.default_view_id).toBe(second.id);
  await connection.db.delete(projects).where(eq(projects.id, native.project_id));
  expect(await service.list(native)).toEqual([]);
  expect(await service.getDefault(native)).toBeNull();
});
