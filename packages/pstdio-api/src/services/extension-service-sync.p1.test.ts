import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  createDb,
  createExtensionInstancesDBService,
  createExtensionUserDataDBService,
  createInstalledExtensionSourcesDBService,
  createProjectsDBService,
} from "pstdio-db";
import { toProjectExtensionInstance } from "../features/extensions/project-extension-instance";
import { EventBus } from "../features/sync/event-bus";
import type { SyncInstalledSourceInput } from "./extension-service";
import { createExtensionService } from "./extension-service";
import { createProjectService } from "./project-service";
import { createSyncService } from "./sync-service";

let close: (() => Promise<void>) | undefined;
let service: ReturnType<typeof createExtensionService>;
let projectService: ReturnType<typeof createProjectService>;
let extensionInstancesService: ReturnType<typeof createExtensionInstancesDBService>;
let installedExtensionSourcesService: ReturnType<typeof createInstalledExtensionSourcesDBService>;
let extensionUserDataService: ReturnType<typeof createExtensionUserDataDBService>;

const createServiceInput = (projectId: string, overrides: Partial<SyncInstalledSourceInput> = {}) =>
  ({
    projectId,
    installName: "planner",
    extensionId: "pstdio.planner",
    name: "planner",
    displayName: "Planner",
    sourceKind: "local_path" as const,
    sourcePath: "/extensions/planner",
    manifest: {},
    ...overrides,
  }) satisfies SyncInstalledSourceInput;

beforeEach(async () => {
  const result = await createDb({ path: ":memory:" });
  close = result.close;
  const projectDbService = createProjectsDBService(result.db);
  projectService = createProjectService({
    syncService: createSyncService({ db: result.db }),
    eventBus: new EventBus(),
    projectsDBService: projectDbService,
  });
  extensionInstancesService = createExtensionInstancesDBService(result.db);
  installedExtensionSourcesService = createInstalledExtensionSourcesDBService(result.db);
  extensionUserDataService = createExtensionUserDataDBService(result.db);
  service = createExtensionService({
    sourceExists: () => true,
    extensionInstancesService,
    installedExtensionSourcesService,
    extensionUserDataService,
    recovery: { exclusive: <T>(_projectId: string, run: () => Promise<T>) => run() },
    projectService,
  });
});

afterEach(async () => {
  await close?.();
});

test("keeps unchanged source metadata stable when runtime views contain callbacks", async () => {
  const project = await projectService.create({ name: "Native views" });
  let refreshes = 0;
  const nativeViews = createExtensionService({
    sourceExists: () => true,
    extensionInstancesService,
    installedExtensionSourcesService,
    extensionUserDataService,
    recovery: { exclusive: <T>(_projectId: string, run: () => Promise<T>) => run() },
    projectService,
    onInstalledSourcesChanged: () => {
      refreshes++;
    },
  });
  const source = () =>
    createServiceInput(project.id, {
      sourceHash: "same-source",
      manifest: { views: [{ id: "tickets", body: { kind: "collection", query: () => [] } }] },
    });
  const first = await nativeViews.syncInstalledSourceForProject(source());
  refreshes = 0;
  const second = await nativeViews.syncInstalledSourceForProject(source());
  expect(second?.installedSource.updated_at).toBe(first?.installedSource.updated_at);
  expect(refreshes).toBe(0);
});

describe("extensionService installed source sync", () => {
  test("attaches a committed source while another project's webviews are refreshing", async () => {
    const firstProject = await projectService.create({ name: "First" });
    const secondProject = await projectService.create({ name: "Second" });
    const refreshing = Promise.withResolvers<void>();
    const releaseRefresh = Promise.withResolvers<void>();
    const concurrentService = createExtensionService({
      sourceExists: () => true,
      extensionInstancesService,
      installedExtensionSourcesService,
      extensionUserDataService,
      recovery: { exclusive: <T>(_projectId: string, run: () => Promise<T>) => run() },
      projectService,
      onInstalledSourcesChanged: async (sourcePath) => {
        if (!sourcePath) return;
        refreshing.resolve();
        await releaseRefresh.promise;
      },
    });
    const first = concurrentService.syncInstalledSourceForProject(createServiceInput(firstProject.id));
    await refreshing.promise;
    const second = concurrentService.syncInstalledSourceForProject(createServiceInput(secondProject.id));
    try {
      const attached = await Promise.race([
        second,
        Bun.sleep(1000).then(() => {
          throw new Error("Project attachment waited for unrelated webview compilation");
        }),
      ]);
      expect(attached?.instance.scope_id).toBe(secondProject.id);
      expect(attached?.instance.enabled).toBe(false);
      const removed = await concurrentService.uninstallProjectExtension({
        projectId: secondProject.id,
        instanceId: attached!.instance.id,
        deleteUserData: true,
      });
      expect(removed).not.toBeNull();
    } finally {
      releaseRefresh.resolve();
      await Promise.all([first, second]);
    }
    expect(await installedExtensionSourcesService.getByInstallName("planner")).toBeNull();
    expect(await extensionInstancesService.list()).toEqual([]);
  });

  test("syncs an installed source as a disabled project instance", async () => {
    const project = await projectService.create({ name: "Extension Project" });

    const result = await service.syncInstalledSourceForProject(
      createServiceInput(project.id, { sourceHash: "hash-1" }),
    );
    const enabledSources = await service.listEnabledSourcesForProject(project.id);

    expect(result!.installedSource.install_name).toBe("planner");
    expect(result!.instance.scope_type).toBe("project");
    expect(result!.instance.scope_id).toBe(project.id);
    expect(result!.instance.enabled).toBe(false);
    expect(enabledSources).toEqual([]);
  });

  test("preserves an enabled project instance when an installed source is synced again", async () => {
    const project = await projectService.create({ name: "Extension Project" });

    const enabled = await service.enableInstalledSourceForProject(
      createServiceInput(project.id, { sourceHash: "hash-1", sourcePath: "/one" }),
    );
    const synced = await service.syncInstalledSourceForProject(
      createServiceInput(project.id, {
        version: "2.0.0",
        sourcePath: "/one",
        sourceHash: "hash-2",
        manifest: { version: "2.0.0" },
      }),
    );

    expect(synced!.installedSource.id).toBe(enabled.installedSource.id);
    // Discovery reports the new source but never adopts it, so the project keeps what it accepted.
    expect(synced!.installedSource.version).toBeNull();
    expect(synced!.installedSource.source_hash).toBe("hash-1");
    expect(synced!.instance.id).toBe(enabled.instance.id);
    expect(synced!.instance.enabled).toBe(true);
  });

  test("enables a previously synced disabled project instance without duplicating it", async () => {
    const project = await projectService.create({ name: "Extension Project" });

    const synced = await service.syncInstalledSourceForProject(createServiceInput(project.id));
    const enabled = await service.enableInstalledSourceForProject(createServiceInput(project.id));
    const projectInstances = await service.listProjectExtensionInstances(project.id);

    expect(enabled.instance.id).toBe(synced!.instance.id);
    expect(enabled.instance.enabled).toBe(true);
    expect(projectInstances).toHaveLength(1);
  });

  test("derives the current package name after an extension is renamed", async () => {
    const project = await projectService.create({ name: "Extension Project" });

    await service.syncInstalledSourceForProject(
      createServiceInput(project.id, { name: "planner", manifest: { name: "planner" }, sourceHash: "hash-1" }),
    );
    // Renaming is adopted by an explicit act, not by discovery.
    await service.enableInstalledSourceForProject(
      createServiceInput(project.id, { name: "ai-planner", manifest: { name: "ai-planner" }, sourceHash: "hash-2" }),
    );

    const records = await service.listProjectExtensionInstances(project.id);
    const dto = toProjectExtensionInstance(records[0].instance, records[0].installedSource);

    expect(records).toHaveLength(1);
    expect(dto.name).toBe("ai-planner");
  });

  test("does not notify installed source listeners when sync data is unchanged", async () => {
    const project = await projectService.create({ name: "Extension Project" });
    let notifyCount = 0;
    const quietService = createExtensionService({
      sourceExists: () => true,
      extensionInstancesService,
      installedExtensionSourcesService,
      extensionUserDataService,
      recovery: { exclusive: <T>(_projectId: string, run: () => Promise<T>) => run() },
      onInstalledSourcesChanged: () => {
        notifyCount += 1;
      },
      projectService,
    });

    await quietService.syncInstalledSourceForProject(createServiceInput(project.id, { sourceHash: "hash-1" }));
    notifyCount = 0;

    await quietService.syncInstalledSourceForProject(createServiceInput(project.id, { sourceHash: "hash-1" }));

    expect(notifyCount).toBe(0);
  });

  test("identifies the source that changed when notifying installed source listeners", async () => {
    const project = await projectService.create({ name: "Extension Project" });
    const changedSourcePaths: Array<string | undefined> = [];
    const notifyingService = createExtensionService({
      sourceExists: () => true,
      extensionInstancesService,
      installedExtensionSourcesService,
      extensionUserDataService,
      recovery: { exclusive: <T>(_projectId: string, run: () => Promise<T>) => run() },
      onInstalledSourcesChanged: (sourcePath) => {
        changedSourcePaths.push(sourcePath);
      },
      projectService,
    });

    await notifyingService.syncInstalledSourceForProject(createServiceInput(project.id));

    expect(changedSourcePaths).toEqual(["/extensions/planner"]);
  });

  test("does not notify installed source listeners when only manifest key order changes", async () => {
    const project = await projectService.create({ name: "Extension Project" });
    let notifyCount = 0;
    const quietService = createExtensionService({
      sourceExists: () => true,
      extensionInstancesService,
      installedExtensionSourcesService,
      extensionUserDataService,
      recovery: { exclusive: <T>(_projectId: string, run: () => Promise<T>) => run() },
      onInstalledSourcesChanged: () => {
        notifyCount += 1;
      },
      projectService,
    });
    const manifest = {
      id: "pstdio.planner",
      name: "planner",
      commands: [],
      displayName: "Planner",
      version: "1.0.0",
    };

    await quietService.syncInstalledSourceForProject(
      createServiceInput(project.id, { manifest, sourceHash: "hash-1" }),
    );
    notifyCount = 0;

    await quietService.syncInstalledSourceForProject(
      createServiceInput(project.id, { manifest, sourceHash: "hash-1" }),
    );

    expect(notifyCount).toBe(0);
  });

  test("prunes project instances whose installed source is no longer discovered", async () => {
    const project = await projectService.create({ name: "Extension Project" });
    await service.syncInstalledSourceForProject(createServiceInput(project.id, { installName: "planner" }));
    await service.syncInstalledSourceForProject(
      createServiceInput(project.id, {
        displayName: "Deleted Extension",
        extensionId: "pstdio.deleted",
        installName: "deleted",
        name: "deleted",
        sourcePath: "/extensions/deleted",
      }),
    );

    const removed = await service.pruneProjectExtensionInstances({
      activeSourcePaths: ["/extensions/planner"],
      projectId: project.id,
      sourcePathPrefix: "/extensions",
    });
    const projectInstances = await service.listProjectExtensionInstances(project.id);

    expect(removed).toHaveLength(1);
    expect(projectInstances.map(({ installedSource }) => installedSource.install_name)).toEqual(["planner"]);
  });

  test("does not prune project instances loaded after the prune snapshot started", async () => {
    const project = await projectService.create({ name: "Extension Project" });
    const snapshotStartedAt = new Date(Date.now() - 1_000).toISOString();

    await service.syncInstalledSourceForProject(createServiceInput(project.id));

    const removed = await service.pruneProjectExtensionInstances({
      activeSourcePaths: [],
      projectId: project.id,
      snapshotStartedAt,
      sourcePathPrefix: "/extensions",
    });
    const projectInstances = await service.listProjectExtensionInstances(project.id);

    expect(removed).toHaveLength(0);
    expect(projectInstances).toHaveLength(1);
  });
});
