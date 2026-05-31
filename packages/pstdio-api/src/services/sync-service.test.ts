import { afterAll, describe, expect, test } from "bun:test";
import type { DbClient } from "pstdio-db";
import {
  createAgentConfigsDBService,
  createDb,
  createExtensionInstancesDBService,
  createInstalledExtensionSourcesDBService,
  createProjectsDBService,
  createStatusesDBService,
} from "pstdio-db";
import { EventBus } from "../features/sync/event-bus";
import { createSyncService, SYNCED_TABLES } from "./sync-service";

let close: () => Promise<void>;
let db: DbClient;
let eventBus: EventBus;

const setup = async () => {
  const result = await createDb({ path: ":memory:" });
  close = result.close;
  db = result.db;
  eventBus = new EventBus();
};

afterAll(async () => {
  await close?.();
});

describe("createSyncService", () => {
  describe("getFullState", () => {
    test("returns all synced tables as keys", async () => {
      await setup();
      const syncService = createSyncService({ db, eventBus });
      const state = await syncService.getFullState();

      for (const table of SYNCED_TABLES) {
        expect(state).toHaveProperty(table);
        expect(Array.isArray(state[table])).toBe(true);
      }
    });

    test("returns empty arrays for fresh database", async () => {
      await setup();
      const syncService = createSyncService({ db, eventBus });
      const state = await syncService.getFullState();

      for (const table of SYNCED_TABLES) {
        expect(state[table]).toHaveLength(0);
      }
    });

    test("returns inserted data", async () => {
      await setup();
      const syncService = createSyncService({ db, eventBus });

      const projectsService = createProjectsDBService(db);
      const agentConfigsService = createAgentConfigsDBService(db);

      await projectsService.create({ name: "test-project" });
      await agentConfigsService.upsert("claude-code");

      const state = await syncService.getFullState();

      expect(state.projects).toHaveLength(1);
      expect((state.projects[0] as Record<string, unknown>).name).toBe("test-project");
      expect(state.ticket_statuses).toHaveLength(6);
      expect(state.attempt_statuses).toHaveLength(5);
      expect(state.ticket_tags).toHaveLength(3);
      expect(state.ticket_tag_options).toHaveLength(10);
      expect(state.agent_configs).toHaveLength(1);
      expect((state.agent_configs[0] as Record<string, unknown>).agent_id).toBe("claude-code");
    });

    test("includes installed extension sources and project instances", async () => {
      await setup();
      const syncService = createSyncService({ db, eventBus });
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
      const syncService = createSyncService({ db, eventBus });

      const projectsService = createProjectsDBService(db);
      const statusesService = createStatusesDBService(db);

      const project = await projectsService.create({ name: "soft-delete-test" });
      const statuses = await statusesService.list(project.id);
      const statusToDelete = statuses.find((s) => !s.is_default)!;

      await statusesService.remove(statusToDelete.id);

      const state = await syncService.getFullState();
      const syncedStatuses = state.ticket_statuses as { id: string }[];

      expect(syncedStatuses.find((s) => s.id === statusToDelete.id)).toBeUndefined();
      expect(syncedStatuses).toHaveLength(statuses.length - 1);
    });
  });

  describe("emitCascadeDeletes", () => {
    test("emits delete event for a simple row", async () => {
      await setup();
      const syncService = createSyncService({ db, eventBus });

      const agentConfigsService = createAgentConfigsDBService(db);
      const config = await agentConfigsService.upsert("claude-code");

      const events: { table: string; op: string; data: unknown }[] = [];
      eventBus.subscribe((e) => events.push(e));

      await syncService.emitCascadeDeletes("agent_configs", config.id);

      expect(events).toHaveLength(1);
      expect(events[0].table).toBe("agent_configs");
      expect(events[0].op).toBe("delete");
      expect(events[0].data).toEqual({ id: config.id });
    });

    test("emits cascade deletes for a project and its dependents", async () => {
      await setup();
      const syncService = createSyncService({ db, eventBus });

      const projectsService = createProjectsDBService(db);
      const project = await projectsService.create({ name: "cascade-test" });

      const events: { table: string; op: string; data: unknown }[] = [];
      eventBus.subscribe((e) => events.push(e));

      await syncService.emitCascadeDeletes("projects", project.id);

      // Should emit deletes for dependents (statuses, tags, tag_options) plus the project itself
      const tables = events.map((e) => e.table);
      expect(tables).toContain("ticket_statuses");
      expect(tables).toContain("attempt_statuses");
      expect(tables).toContain("ticket_tags");
      expect(tables).toContain("ticket_tag_options");
      expect(tables).toContain("projects");

      // The project delete should be last
      expect(events[events.length - 1].table).toBe("projects");
      expect(events[events.length - 1].data).toEqual({ id: project.id });
    });

    test("does nothing for a non-existent row", async () => {
      await setup();
      const syncService = createSyncService({ db, eventBus });

      const events: { table: string; op: string; data: unknown }[] = [];
      eventBus.subscribe((e) => events.push(e));

      await syncService.emitCascadeDeletes("projects", "non-existent-id");

      expect(events).toHaveLength(0);
    });
  });
});
