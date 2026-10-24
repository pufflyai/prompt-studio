import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createDb,
  createExtensionInstancesDBService,
  createExtensionUserDataDBService,
  createInstalledExtensionSourcesDBService,
  createProjectsDBService,
} from "pstdio-db";
import { EventBus } from "../features/sync/event-bus";
import { createExtensionService } from "./extension-service";
import { createProjectService } from "./project-service";
import { createSyncService } from "./sync-service";

test.each(["before registration", "during registration"])("uninstall wins over discovery %s", async (phase) => {
  const root = mkdtempSync(join(tmpdir(), "extension-uninstall-discovery-"));
  const sourcePath = join(root, ".pstdio", "extensions", "planner");
  mkdirSync(sourcePath, { recursive: true });
  const database = await createDb({ path: ":memory:" });
  try {
    const projectService = createProjectService({
      syncService: createSyncService({ db: database.db }),
      eventBus: new EventBus(),
      projectsDBService: createProjectsDBService(database.db),
    });
    const sources = createInstalledExtensionSourcesDBService(database.db);
    const readSource = sources.getBySourcePath;
    const discoveryRead = Promise.withResolvers<void>();
    const releaseDiscovery = Promise.withResolvers<void>();
    let pauseDiscovery = false;
    sources.getBySourcePath = async (path) => {
      const source = await readSource(path);
      if (pauseDiscovery) {
        pauseDiscovery = false;
        discoveryRead.resolve();
        await releaseDiscovery.promise;
      }
      return source;
    };
    const instances = createExtensionInstancesDBService(database.db);
    const service = createExtensionService({
      projectService,
      installedExtensionSourcesService: sources,
      extensionInstancesService: instances,
      extensionUserDataService: createExtensionUserDataDBService(database.db),
      recovery: { exclusive: <T>(_projectId: string, run: () => Promise<T>) => run() },
    });
    const project = await projectService.create({ name: "Discovery race" });
    const snapshot = {
      projectId: project.id,
      installName: "planner",
      extensionId: "pstdio.planner",
      name: "planner",
      displayName: "Planner",
      manifest: {},
      sourcePath,
    };
    const enabled = await service.enableInstalledSourceForProject(snapshot);
    const uninstall = () =>
      service.uninstallProjectExtension({
        projectId: project.id,
        instanceId: enabled.instance.id,
        deleteUserData: true,
      });
    if (phase === "during registration") {
      pauseDiscovery = true;
      const discovery = service.syncInstalledSourceForProject(snapshot);
      await discoveryRead.promise;
      const removal = uninstall();
      // Give uninstall a turn while discovery still holds its source snapshot.
      await Bun.sleep(0);
      releaseDiscovery.resolve();
      await Promise.all([discovery, removal]);
    } else {
      await uninstall();
      await service.syncInstalledSourceForProject(snapshot);
    }

    expect(await sources.getBySourcePath(sourcePath)).toBeNull();
    expect(await instances.list({ scope_id: project.id, scope_type: "project" })).toEqual([]);
  } finally {
    await database.close();
    rmSync(root, { recursive: true, force: true });
  }
});
