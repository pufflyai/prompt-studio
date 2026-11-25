import { expect, test } from "bun:test";
import { createDb, createExtensionUserDataDBService } from "pstdio-db";
import { createAppDatabaseServices } from "../../app-database";
import { createExtensionService } from "../../services/extension-service";
import { createProjectService } from "../../services/project-service";
import { createSyncService } from "../../services/sync-service";
import { EventBus } from "../sync/event-bus";

for (const action of ["register", "reload"] as const)
  test(`connected board readers follow runtime identity recovery during ${action}`, async () => {
    const store = await createDb({ path: ":memory:" });
    try {
      const eventBus = new EventBus();
      const dbs = createAppDatabaseServices(store.db, ":memory:", undefined, eventBus);
      const sync = createSyncService({ db: store.db });
      const projectService = createProjectService({
        syncService: sync,
        eventBus,
        projectsDBService: dbs.projectsDBService,
      });
      const project = await projectService.create({ name: "Runtime board recovery" });
      const scope = { project_id: project.id, extension_id: "pstdio.pstdio-notes", board_id: "tasks" };
      const view = await dbs.boardViewsDBService.create({
        ...scope,
        title: "Retained custom",
        settings: { viewMode: "board", columnGrouping: "none", rowGrouping: "none", displayProperties: [] },
        filter: { conjunction: "and", rules: [] },
        sorts: [],
      });
      const stamp = "2026-11-20T00:00:00.000Z";
      await dbs.boardViewsDBService.setDefault(scope, view.id);
      await dbs.boardViewsDBService.setDefault({ ...scope, board_id: "built-in-only" }, "builtin");
      await store.pglite.query(
        `INSERT INTO extensions (id,extension_id,install_name,display_name,source_path,source_kind,manifest_json,status,last_error_json,created_at,updated_at)
        VALUES ('source','pstdio.notes','notes','Notes','/probe/notes','local_path','{"name":"notes","publisher":"pstdio"}','error','{"code":"extension_identity_conflict"}',$1,$1)`,
        [stamp],
      );
      const initial = await sync.getFullState();
      const cache = {
        board_views: new Map(initial.board_views.map((row) => [(row as { id: string }).id, row])),
        board_default_views: new Map(initial.board_default_views.map((row) => [(row as { id: string }).id, row])),
      };
      const before = eventBus.seq;
      if (action === "reload")
        await dbs.installedExtensionSourcesDBService.updateLoadState("source", { status: "loaded" });
      else {
        const extensions = createExtensionService({
          sourceExists: () => true,
          eventBus,
          projectService,
          installedExtensionSourcesService: dbs.installedExtensionSourcesDBService,
          extensionInstancesService: dbs.extensionInstancesDBService,
          extensionUserDataService: createExtensionUserDataDBService(store.db),
          recovery: { exclusive: async (_id, run) => run() },
        });
        await extensions.registerInstalledSource({
          installName: "notes",
          extensionId: "pstdio.notes",
          name: "notes",
          displayName: "Notes",
          sourceKind: "local_path",
          sourcePath: "/probe/notes",
          sourceHash: "new",
          manifest: { name: "notes", publisher: "pstdio" },
        });
      }
      for (const event of eventBus.getSince(before)) {
        if (event.table !== "board_views" && event.table !== "board_default_views") continue;
        const row = event.data as { id: string };
        if (event.op === "delete") cache[event.table].delete(row.id);
        else cache[event.table].set(row.id, event.data);
      }
      const current = await sync.getFullState();
      expect([...cache.board_views.values()]).toEqual(current.board_views);
      expect([...cache.board_default_views.values()]).toEqual(current.board_default_views);
      expect(current.board_views[0]).toMatchObject({ id: view.id, extension_instance_id: "pstdio.notes" });
      const canonical = eventBus.seq;
      await dbs.installedExtensionSourcesDBService.updateRegistration("source", {
        extension_id: "pstdio.notes",
        source_hash: "next",
      });
      expect(
        eventBus
          .getSince(canonical)
          .filter((event) => event.table === "board_views" || event.table === "board_default_views"),
      ).toEqual([]);
    } finally {
      await store.close();
    }
  });
