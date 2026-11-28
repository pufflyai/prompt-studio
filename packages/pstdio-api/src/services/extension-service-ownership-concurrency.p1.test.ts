import { afterEach, beforeEach, expect, test } from "bun:test";
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
  projectService = createProjectService({
    syncService: createSyncService({ db: result.db }),
    eventBus: new EventBus(),
    projectsDBService: createProjectsDBService(result.db),
  });
  installedExtensionSourcesService = createInstalledExtensionSourcesDBService(result.db);
  extensionInstancesService = createExtensionInstancesDBService(result.db);
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

test("concurrent installs leave a single project installation", async () => {
  const project = await projectService.create({ name: "Extension Project" });
  const installs = ["repo-one", "repo-two"].map((repo) =>
    service.enableInstalledSourceForProject({
      projectId: project.id,
      ...fontEditorSource(`/${repo}/.pstdio/extensions/font-editor`),
    }),
  );
  const [, last] = await Promise.all(installs);

  expect(await service.listProjectExtensionInstances(project.id)).toEqual([last]);
});
