import { expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Worker } from "node:worker_threads";
import {
  createDb,
  createExtensionInstancesDBService,
  createExtensionUserDataDBService,
  createInstalledExtensionSourcesDBService,
  createProjectsDBService,
} from "pstdio-db";
import { configureExtensionPreparationWorker, stopExtensionPreparation } from "pstdio-extensions";
import { EventBus } from "../features/sync/event-bus";
import { createExtensionService } from "./extension-service";
import { createProjectService } from "./project-service";
import { createSyncService } from "./sync-service";

test("unavailable preparation leaves an installed tool and its enabled registration intact", async () => {
  const root = mkdtempSync(join(tmpdir(), "extension-uninstall-preparation-"));
  const sourcePath = join(root, ".pstdio/extensions/tool");
  mkdirSync(sourcePath, { recursive: true });
  writeFileSync(join(sourcePath, "extension.ts"), "export const installed = true;");
  const database = await createDb({ path: ":memory:" });
  try {
    const projectService = createProjectService({
      syncService: createSyncService({ db: database.db }),
      eventBus: new EventBus(),
      projectsDBService: createProjectsDBService(database.db),
    });
    const sources = createInstalledExtensionSourcesDBService(database.db);
    const instances = createExtensionInstancesDBService(database.db);
    const service = createExtensionService({
      projectService,
      installedExtensionSourcesService: sources,
      extensionInstancesService: instances,
      extensionUserDataService: createExtensionUserDataDBService(database.db),
      recovery: { exclusive: <T>(_projectId: string, run: () => Promise<T>) => run() },
    });
    const project = await projectService.create({ name: "Preparation failure" });
    const enabled = await service.enableInstalledSourceForProject({
      projectId: project.id,
      installName: "tool",
      extensionId: "example.tool",
      name: "tool",
      displayName: "Tool",
      manifest: {},
      sourcePath,
    });
    await stopExtensionPreparation();
    configureExtensionPreparationWorker(() => {
      throw new Error("Worker unavailable");
    });
    await expect(
      service.uninstallProjectExtension({ projectId: project.id, instanceId: enabled.instance.id }),
    ).rejects.toThrow("Worker unavailable");
    expect(existsSync(join(sourcePath, "extension.ts"))).toBe(true);
    expect(await sources.getBySourcePath(sourcePath)).not.toBeNull();
    expect(await instances.get(enabled.instance.id)).toMatchObject({ enabled: true });
  } finally {
    await stopExtensionPreparation();
    configureExtensionPreparationWorker(
      () => new Worker(new URL("../features/extensions/extension-preparation-worker.ts", import.meta.url)),
    );
    await database.close();
    rmSync(root, { recursive: true, force: true });
  }
});
