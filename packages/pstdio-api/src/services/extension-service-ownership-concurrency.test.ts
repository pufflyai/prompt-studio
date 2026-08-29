import { afterEach, beforeEach, expect, test } from "bun:test";
import {
  createDb,
  createExtensionInstancesDBService,
  createExtensionUserDataDBService,
  createInstalledExtensionSourcesDBService,
  createProjectsDBService,
} from "pstdio-db";
import { createExtensionService } from "./extension-service";
import { createProjectService } from "./project-service";

let close: (() => Promise<void>) | undefined;
let service: ReturnType<typeof createExtensionService>;
let projectService: ReturnType<typeof createProjectService>;
let installedExtensionSourcesService: ReturnType<typeof createInstalledExtensionSourcesDBService>;
let extensionInstancesService: ReturnType<typeof createExtensionInstancesDBService>;
let extensionUserDataService: ReturnType<typeof createExtensionUserDataDBService>;

const fontEditorSource = (sourcePath: string) => ({
  displayName: "Font Editor",
  extensionId: "pstdio.font-editor",
  installName: "font-editor",
  manifest: {},
  name: "font-editor",
  sourceKind: "local_path" as const,
  sourcePath,
});

beforeEach(async () => {
  const result = await createDb({ path: ":memory:" });
  close = result.close;
  projectService = createProjectService({ projectsDBService: createProjectsDBService(result.db) });
  installedExtensionSourcesService = createInstalledExtensionSourcesDBService(result.db);
  extensionInstancesService = createExtensionInstancesDBService(result.db);
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

test("concurrent ownership claims leave one provider enabled", async () => {
  const project = await projectService.create({ name: "Extension Project" });
  const first = await service.syncInstalledSourceForProject({
    projectId: project.id,
    ...fontEditorSource("/repo-one/.pstdio/extensions/font-editor"),
  });
  const second = await service.syncInstalledSourceForProject({
    projectId: project.id,
    ...fontEditorSource("/repo-two/.pstdio/extensions/font-editor"),
  });

  let enabledUpdateCount = 0;
  let releaseEnabledUpdates = () => {};
  const enabledUpdatesFinished = new Promise<void>((resolve) => {
    releaseEnabledUpdates = resolve;
  });
  let snapshotCount = 0;
  let releaseSnapshots = () => {};
  const snapshotsFinished = new Promise<void>((resolve) => {
    releaseSnapshots = resolve;
  });
  const concurrentService = createExtensionService({
    extensionInstancesService: {
      ...extensionInstancesService,
      update: async (...args: Parameters<typeof extensionInstancesService.update>) => {
        const updated = await extensionInstancesService.update(...args);
        if (args[1].enabled !== true) return updated;

        enabledUpdateCount += 1;
        if (enabledUpdateCount === 2) releaseEnabledUpdates();
        await enabledUpdatesFinished;
        return updated;
      },
      list: async (...args: Parameters<typeof extensionInstancesService.list>) => {
        const instances = await extensionInstancesService.list(...args);
        snapshotCount += 1;
        if (snapshotCount === 2) releaseSnapshots();
        await snapshotsFinished;
        return instances;
      },
    },
    installedExtensionSourcesService,
    extensionUserDataService,
    projectService,
  });

  await Promise.all([
    concurrentService.setProjectExtensionEnabled(first.instance.id, true),
    concurrentService.setProjectExtensionEnabled(second.instance.id, true),
  ]);

  const enabled = await service.listEnabledSourcesForProject(project.id);
  expect(enabled).toHaveLength(1);
});
