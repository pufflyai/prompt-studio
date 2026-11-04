import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestApp } from "../../test-utils/create-test-app";
import { folderProjectInput } from "../../test-utils/folder-project-input";
import { writeExtension } from "./default-extensions-test-fixtures";
import { attachInstalledExtensionsForProject } from "./installed-extension-sync";

test.each(["before", "during"])("project attachment preserves a build failure recorded %s discovery", async (phase) => {
  const root = await mkdtemp(join(tmpdir(), "installed-extension-attachment-"));
  const previous = { home: process.env.PSTDIO_HOME, defaults: process.env.PSTDIO_DEFAULT_EXTENSIONS };
  process.env.PSTDIO_HOME = join(root, "home");
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  const sourcePath = join(root, "home/extensions/optional-tool");
  writeExtension(sourcePath, "optional-tool");
  const handle = await createTestApp({ databasePath: ":memory:", storageRoot: join(root, "storage") });
  const releaseSnapshot = Promise.withResolvers<void>();
  let attaching: Promise<unknown> | undefined;
  try {
    const created = await handle.app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(folderProjectInput({ name: "First" })),
    });
    expect(created.status).toBe(201);
    const project = await handle.deps.projectService.create({ name: "Second" });
    const sources = handle.deps.installedExtensionSourcesService;
    const accepted = (await sources.getBySourcePath(sourcePath))!;
    const reportFailure = async () => {
      const failure = await handle.deps.extensionService.reportWebviewBuildFailure(
        accepted.id,
        "main",
        new Error("Current build failed"),
        { sourcePath, sourceHash: accepted.source_hash, updatedAt: accepted.updated_at },
      );
      expect(failure.status).toBe("reported");
    };
    if (phase === "before") await reportFailure();
    const snapshotTaken = Promise.withResolvers<void>();
    attaching = attachInstalledExtensionsForProject({
      extensionService: handle.deps.extensionService,
      installedExtensionSourcesService: {
        list: async () => {
          const snapshot = await sources.list();
          snapshotTaken.resolve();
          if (phase === "during") await releaseSnapshot.promise;
          return snapshot;
        },
      },
      projectId: project.id,
    });
    await snapshotTaken.promise;
    if (phase === "during") await reportFailure();
    const failed = (await sources.getBySourcePath(sourcePath))!;
    expect(failed.status).toBe("error");
    releaseSnapshot.resolve();
    await attaching;

    expect(await sources.getBySourcePath(sourcePath)).toMatchObject({
      status: "error",
      last_error_json: failed.last_error_json,
      source_hash: failed.source_hash,
      loaded_revision: failed.loaded_revision,
      updated_at: failed.updated_at,
    });
    const instances = await handle.deps.extensionService.listProjectExtensionInstances(project.id);
    expect(instances).toHaveLength(1);
    expect(instances[0].instance.enabled).toBe(false);
    expect(instances[0].installedSource.id).toBe(accepted.id);
  } finally {
    releaseSnapshot.resolve();
    await attaching;
    await handle.close();
    if (previous.home === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previous.home;
    if (previous.defaults === undefined) delete process.env.PSTDIO_DEFAULT_EXTENSIONS;
    else process.env.PSTDIO_DEFAULT_EXTENSIONS = previous.defaults;
    await rm(root, { recursive: true, force: true });
  }
});
