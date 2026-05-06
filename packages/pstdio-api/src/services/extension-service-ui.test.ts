import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  createDb,
  createExtensionInstancesDBService,
  createInstalledExtensionSourcesDBService,
  createProjectsDBService,
} from "pstdio-db";
import { createExtensionService } from "./extension-service";
import { createProjectService } from "./project-service";

let close: (() => Promise<void>) | undefined;
let service: ReturnType<typeof createExtensionService>;
let projectService: ReturnType<typeof createProjectService>;

beforeEach(async () => {
  const result = await createDb({ path: ":memory:" });
  close = result.close;
  projectService = createProjectService({ projectsDBService: createProjectsDBService(result.db) });
  service = createExtensionService({
    extensionInstancesService: createExtensionInstancesDBService(result.db),
    installedExtensionSourcesService: createInstalledExtensionSourcesDBService(result.db),
    projectService,
  });
});

afterEach(async () => {
  await close?.();
});

describe("extension UI metadata", () => {
  test("returns only enabled project extension sources", async () => {
    const project = await projectService.create({ name: "Extension Project" });
    const enabled = await service.enableInstalledSourceForProject({
      projectId: project.id,
      installName: "lab",
      extensionId: "pstdio.extension-lab",
      namespace: "lab",
      displayName: "Lab",
      sourceKind: "local_path",
      sourcePath: "/extensions/lab",
      manifest: {},
    });
    const disabled = await service.enableInstalledSourceForProject({
      projectId: project.id,
      installName: "muted",
      extensionId: "pstdio.muted",
      namespace: "muted",
      displayName: "Muted",
      sourceKind: "local_path",
      sourcePath: "/extensions/muted",
      manifest: {},
    });
    await service.setProjectExtensionEnabled(disabled.instance.id, false);

    await expect(service.listEnabledProjectExtensionSources(project.id)).resolves.toEqual([
      expect.objectContaining({ id: enabled.installedSource.id, source_path: "/extensions/lab" }),
    ]);
  });
});
