import { afterEach, expect, test } from "bun:test";
import {
  createDb,
  createExtensionInstancesDBService,
  createExtensionUserDataDBService,
  createInstalledExtensionSourcesDBService,
  createProjectsDBService,
} from "pstdio-db";
import { AlwaysEnabledExtensionError } from "../features/extensions/always-on-extensions";
import { EventBus } from "../features/sync/event-bus";
import { createExtensionService } from "./extension-service";
import { createProjectService } from "./project-service";
import { createSyncService } from "./sync-service";

let close: (() => Promise<void>) | undefined;
afterEach(async () => close?.());

test("team policy protects a required tool from disable, removal and provider replacement", async () => {
  const database = await createDb({ path: ":memory:" });
  close = database.close;
  const instances = createExtensionInstancesDBService(database.db);
  const sources = createInstalledExtensionSourcesDBService(database.db);
  const projectService = createProjectService({
    syncService: createSyncService({ db: database.db }),
    eventBus: new EventBus(),
    projectsDBService: createProjectsDBService(database.db),
  });
  const project = await projectService.create({ name: "Team project" });
  const personal = await projectService.create({ name: "Personal project" });
  let required = false;
  const service = createExtensionService({
    extensionInstancesService: instances,
    installedExtensionSourcesService: sources,
    extensionUserDataService: createExtensionUserDataDBService(database.db),
    recovery: { exclusive: <T>(_id: string, run: () => Promise<T>) => run() },
    projectService,
    isProjectExtensionManaged: async (projectId, extensionId) =>
      required && projectId === project.id && extensionId === "example.tools",
  });
  const source = {
    extensionId: "example.tools",
    installName: "tools",
    name: "tools",
    displayName: "Tools",
    manifest: {},
    sourcePath: "/managed-extension-test/tools",
    sourceHash: "original",
  };
  const installed = await service.enableInstalledSourceForProject({ ...source, projectId: project.id });
  const personalInstance = await service.enableInstalledSourceForProject({ ...source, projectId: personal.id });
  const alternate = await service.registerInstalledSource({
    ...source,
    installName: "replacement",
    sourcePath: "/managed-extension-test/replacement",
  });
  const alternateInstance = await instances.create({
    installed_extension_id: alternate.id,
    scope_id: project.id,
    scope_type: "project",
    enabled: false,
  });
  required = true;

  await expect(service.setProjectExtensionEnabled(installed.instance.id, false)).rejects.toBeInstanceOf(
    AlwaysEnabledExtensionError,
  );
  await expect(
    service.uninstallProjectExtension({ projectId: project.id, instanceId: installed.instance.id }),
  ).rejects.toBeInstanceOf(AlwaysEnabledExtensionError);
  await expect(service.setProjectExtensionEnabled(alternateInstance.id, true)).rejects.toBeInstanceOf(
    AlwaysEnabledExtensionError,
  );
  await expect(
    service.enableInstalledSourceForProject({
      ...source,
      projectId: project.id,
      installName: "new-copy",
      sourcePath: "/managed-extension-test/new-copy",
    }),
  ).rejects.toBeInstanceOf(AlwaysEnabledExtensionError);
  expect(await sources.getByInstallName("new-copy")).toBeNull();
  expect((await instances.get(installed.instance.id))?.enabled).toBe(true);
  expect((await instances.get(alternateInstance.id))?.enabled).toBe(false);
  expect(await instances.hasProjectDefaultChoice(project.id, source.extensionId)).toBe(false);
  expect(await service.adoptDefaultSourceForProject(project.id, alternate.id)).toBeNull();
  await expect(service.registerInstalledSource({ ...source, sourceHash: "substitute" })).rejects.toBeInstanceOf(
    AlwaysEnabledExtensionError,
  );
  expect((await sources.get(installed.installedSource.id))?.source_hash).toBe("original");

  // A shared source cannot be changed through a personal project's upgrade either.
  await expect(service.assertInstalledSourceChoice(installed.installedSource.id)).rejects.toBeInstanceOf(
    AlwaysEnabledExtensionError,
  );
  expect((await service.setProjectExtensionEnabled(personalInstance.instance.id, false))?.enabled).toBe(false);

  // Removing the requirement keeps the installation and restores ordinary controls.
  required = false;
  await service.assertInstalledSourceChoice(installed.installedSource.id);
  expect((await service.setProjectExtensionEnabled(installed.instance.id, false))?.enabled).toBe(false);
  expect(await sources.get(installed.installedSource.id)).not.toBeNull();
});
