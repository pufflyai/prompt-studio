import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  createDb,
  createExtensionInstancesDBService,
  createExtensionUserDataDBService,
  createInstalledExtensionSourcesDBService,
  createProjectsDBService,
} from "pstdio-db";
import { toProjectExtensionInstance } from "../features/extensions/project-extension-instance";
import type { SyncInstalledSourceInput } from "./extension-service";
import { createExtensionService } from "./extension-service";
import { createProjectService } from "./project-service";

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
  projectService = createProjectService({ projectsDBService: projectDbService });
  extensionInstancesService = createExtensionInstancesDBService(result.db);
  installedExtensionSourcesService = createInstalledExtensionSourcesDBService(result.db);
  extensionUserDataService = createExtensionUserDataDBService(result.db);
  service = createExtensionService({
    extensionInstancesService,
    installedExtensionSourcesService,
    extensionUserDataService,
    projectService,
  });
});

afterEach(async () => {
  await close?.();
});

describe("extensionService installed source sync", () => {
  test("syncs an installed source as a disabled project instance", async () => {
    const project = await projectService.create({ name: "Extension Project" });

    const result = await service.syncInstalledSourceForProject(
      createServiceInput(project.id, { sourceHash: "hash-1" }),
    );
    const enabledSources = await service.listEnabledSourcesForProject(project.id);

    expect(result.installedSource.install_name).toBe("planner");
    expect(result.instance.scope_type).toBe("project");
    expect(result.instance.scope_id).toBe(project.id);
    expect(result.instance.enabled).toBe(false);
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

    expect(synced.installedSource.id).toBe(enabled.installedSource.id);
    expect(synced.installedSource.version).toBe("2.0.0");
    expect(synced.instance.id).toBe(enabled.instance.id);
    expect(synced.instance.enabled).toBe(true);
  });

  test("enables a previously synced disabled project instance without duplicating it", async () => {
    const project = await projectService.create({ name: "Extension Project" });

    const synced = await service.syncInstalledSourceForProject(createServiceInput(project.id));
    const enabled = await service.enableInstalledSourceForProject(createServiceInput(project.id));
    const projectInstances = await service.listProjectExtensionInstances(project.id);

    expect(enabled.instance.id).toBe(synced.instance.id);
    expect(enabled.instance.enabled).toBe(true);
    expect(projectInstances).toHaveLength(1);
  });

  test("derives the current package name after an extension is renamed", async () => {
    const project = await projectService.create({ name: "Extension Project" });

    await service.syncInstalledSourceForProject(
      createServiceInput(project.id, { name: "planner", manifest: { name: "planner" }, sourceHash: "hash-1" }),
    );
    await service.syncInstalledSourceForProject(
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
      extensionInstancesService,
      installedExtensionSourcesService,
      extensionUserDataService,
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

  test("does not notify installed source listeners when only manifest key order changes", async () => {
    const project = await projectService.create({ name: "Extension Project" });
    let notifyCount = 0;
    const quietService = createExtensionService({
      extensionInstancesService,
      installedExtensionSourcesService,
      extensionUserDataService,
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
