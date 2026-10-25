import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  createBoardViewsDBService,
  createDb,
  createExtensionInstancesDBService,
  createExtensionStorageDBService,
  createInstalledExtensionSourcesDBService,
  createProjectsDBService,
  createSessionsDBService,
  createWorkspaceSessionsDBService,
  createWorkspacesDBService,
  type DbClient,
  eq,
  extension_instances,
  projects,
} from "pstdio-db";
import { EventBus } from "../features/sync/event-bus";
import { createProjectService } from "./project-service";
import { createSyncService } from "./sync-service";

let close: () => Promise<void>;
let db: DbClient;
let eventBus: EventBus;
let service: ReturnType<typeof createProjectService>;

beforeEach(async () => {
  ({ db, close } = await createDb({ path: ":memory:" }));
  eventBus = new EventBus();
  service = createProjectService({
    projectsDBService: createProjectsDBService(db),
    syncService: createSyncService({ db }),
    eventBus,
  });
});

afterEach(async () => {
  await close();
});

const recordEvents = () => {
  const events: { table: string; op: string; data: unknown }[] = [];
  eventBus.subscribe((event) => events.push({ table: event.table, op: event.op, data: event.data }));
  return events;
};

describe("ProjectService", () => {
  test("setDefaults publishes the changed project", async () => {
    const project = await service.create({ name: "Defaults" });
    const events = recordEvents();

    await service.setDefaults(project.id, { default_agent_id: "test.harness.agent", default_agent_model: "model" });

    expect(events).toEqual([
      {
        table: "projects",
        op: "set",
        data: expect.objectContaining({
          id: project.id,
          default_agent_id: "test.harness.agent",
          default_agent_model: "model",
        }),
      },
    ]);
  });

  test("delete publishes every synced dependent after the rows are gone", async () => {
    const project = await service.create({ name: "Cascade" });
    const workspace = await createWorkspacesDBService(db).create({ project_id: project.id, shorthand_base: "WS" });
    const session = await createSessionsDBService(db).create({
      project_id: project.id,
      title: "Session",
      agent: "test-agent",
    });
    const link = await createWorkspaceSessionsDBService(db).link(workspace.id, session.id);
    const source = await createInstalledExtensionSourcesDBService(db).register({
      install_name: "lab",
      extension_id: "test.lab",
      display_name: "Lab",
      source_kind: "local_path",
      source_path: "/extensions/lab",
    });
    const instance = await createExtensionInstancesDBService(db).create({
      installed_extension_id: source.id,
      scope_type: "project",
      scope_id: project.id,
    });
    // Rows that point at the instance with a restricting foreign key must not block the delete.
    const view = await createBoardViewsDBService(db).create({
      project_id: project.id,
      extension_instance_id: instance.id,
      board_id: "tasks",
      title: "Tasks",
      settings: { viewMode: "board", columnGrouping: "none", rowGrouping: "none", displayProperties: [] },
      filter: { conjunction: "and", rules: [] },
      sorts: [],
    });
    await createExtensionStorageDBService(db).setKv({
      extension_instance_id: instance.id,
      scope_type: "project",
      scope_id: project.id,
      key: "state",
      value_json: {},
      project_id: project.id,
    });
    const events = recordEvents();
    const projectRowsAtEmit: Promise<unknown[]>[] = [];
    // PGlite runs queries in order, so a read started inside the listener sees the state at emit time.
    eventBus.subscribe(() => {
      projectRowsAtEmit.push(Promise.resolve(db.select().from(projects).where(eq(projects.id, project.id))));
    });

    expect(await service.delete(project.id)).toBe(true);

    expect(events).toEqual(
      expect.arrayContaining([
        { table: "workspaces", op: "delete", data: { id: workspace.id } },
        { table: "sessions", op: "delete", data: { id: session.id } },
        { table: "workspace_sessions", op: "delete", data: { id: link.id } },
        {
          table: "extension_instances",
          op: "delete",
          data: expect.objectContaining({ id: instance.id, scope_type: "project", scope_id: project.id }),
        },
      ]),
    );
    const indexOf = (table: string) => events.findIndex((event) => event.table === table);
    expect(indexOf("board_views")).toBeLessThan(indexOf("extension_instances"));
    expect(events).toContainEqual({ table: "board_views", op: "delete", data: { id: view.id } });
    expect(events.at(-1)).toEqual({ table: "projects", op: "delete", data: { id: project.id } });
    expect(indexOf("workspace_sessions")).toBeLessThan(indexOf("workspaces"));
    for (const rows of await Promise.all(projectRowsAtEmit)) expect(rows).toEqual([]);
    expect(await db.select().from(extension_instances).where(eq(extension_instances.id, instance.id))).toEqual([]);
  });

  test("delete of a missing project publishes nothing", async () => {
    const events = recordEvents();

    expect(await service.delete("missing")).toBe(false);

    expect(events).toEqual([]);
  });
});
