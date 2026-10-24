import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestApp } from "../../test-utils/create-test-app";
import { folderProjectInput } from "../../test-utils/folder-project-input";
import { writeExtension } from "./default-extensions-test-fixtures";
import { syncInstalledExtensionsForProject } from "./installed-extension-sync";

test("host-marked extensions stay enabled in existing and new projects", async () => {
  const root = mkdtempSync(join(tmpdir(), "always-on-extensions-"));
  const previous = { home: process.env.PSTDIO_HOME, catalog: process.env.PSTDIO_EXTENSION_CATALOG };
  process.env.PSTDIO_HOME = join(root, "home");
  process.env.PSTDIO_EXTENSION_CATALOG = join(root, "catalog.json");
  const sourcePath = join(process.env.PSTDIO_HOME, "extensions", "app-tools");
  writeExtension(sourcePath, "app-tools", "user");
  const catalog = {
    version: 1,
    extensions: [
      {
        installName: "app-tools",
        displayName: "App Tools",
        description: "App settings",
        default: false,
        alwaysEnabled: false,
        origin: {
          kind: "git",
          url: "https://github.com/pufflyai/prompt-studio",
          path: "extensions/app-tools",
          ref: "main",
        },
      },
    ],
  };
  writeFileSync(process.env.PSTDIO_EXTENSION_CATALOG, JSON.stringify(catalog));
  let handle: Awaited<ReturnType<typeof createTestApp>> | undefined;
  try {
    handle = await createTestApp({ databasePath: ":memory:", storageRoot: join(root, "storage") });
    const { app, deps } = handle;
    const project = await deps.projectService.create({ name: "Existing project" });
    await syncInstalledExtensionsForProject({ extensionService: deps.extensionService, projectId: project.id });
    const [before] = await deps.extensionService.listProjectExtensionInstances(project.id);
    expect(before?.instance.enabled).toBe(false);
    writeExtension(join(process.env.PSTDIO_HOME, "extensions", "optional-copy"), "app-tools", "user");
    await syncInstalledExtensionsForProject({ extensionService: deps.extensionService, projectId: project.id });
    const optional = (await deps.extensionService.listProjectExtensionInstances(project.id)).find(
      (copy) => copy.installedSource.install_name === "optional-copy",
    );
    // The host reads each catalog source once, so the new policy comes from a new catalog source.
    catalog.extensions[0]!.alwaysEnabled = true;
    process.env.PSTDIO_EXTENSION_CATALOG = join(root, "catalog-required.json");
    writeFileSync(process.env.PSTDIO_EXTENSION_CATALOG, JSON.stringify(catalog));
    // A required provider also wins while discovery is restoring a disabled instance.
    await expect(deps.extensionService.setProjectExtensionEnabled(optional!.instance.id, true)).rejects.toMatchObject({
      name: "AlwaysEnabledExtensionError",
    });
    const claims = await Promise.allSettled([
      deps.extensionService.setProjectExtensionEnabled(optional!.instance.id, true),
      syncInstalledExtensionsForProject({ extensionService: deps.extensionService, projectId: project.id }),
    ]);
    expect(claims[0]?.status).toBe("rejected");
    expect(claims[1]?.status).toBe("fulfilled");
    expect((await deps.extensionService.listEnabledSourcesForProject(project.id))[0]?.instance.id).toBe(
      before!.instance.id,
    );

    // A second installed copy cannot replace a required provider during project setup.
    const created = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(folderProjectInput({ name: "New project" })),
    });
    expect(created.status).toBe(201);
    const newProject = await created.json();
    expect((await deps.workspaceService.getDefault(newProject.id))?.setup_error).toBeNull();
    const [enabled] = await deps.extensionService.listEnabledSourcesForProject(newProject.id);
    expect(enabled?.installedSource.extension_id).toBe("pstdio.app-tools");
    const copies = await deps.extensionService.listProjectExtensionInstances(newProject.id);
    expect(copies.find((copy) => copy.installedSource.install_name === "optional-copy")?.instance.enabled).toBe(false);
    const url = `/v1/projects/${newProject.id}/extensions/${enabled!.instance.id}`;
    const disabled = await app.request(url, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: false }),
    });
    expect(disabled.status).toBe(409);
    expect((await app.request(url, { method: "DELETE" })).status).toBe(409);
    expect(existsSync(sourcePath)).toBe(true);
    expect(await deps.extensionService.listEnabledSourcesForProject(newProject.id)).toHaveLength(1);
  } finally {
    await handle?.close();
    if (previous.home === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previous.home;
    if (previous.catalog === undefined) delete process.env.PSTDIO_EXTENSION_CATALOG;
    else process.env.PSTDIO_EXTENSION_CATALOG = previous.catalog;
    rmSync(root, { recursive: true, force: true });
  }
});
