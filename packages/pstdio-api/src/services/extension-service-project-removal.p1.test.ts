import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeExtension } from "../features/extensions/default-extensions-test-fixtures";
import { hashExtensionSource, loadExtensionSource } from "../features/extensions/extension-runtime";
import { createTestExtensionSource } from "../features/extensions/test-utils/create-test-extension-source";
import { createTestApp } from "../test-utils/create-test-app";
import { expectRejection } from "../test-utils/expect-rejection";
import { ProjectNotFoundError } from "./extension-service";

let root: string;
let handle: Awaited<ReturnType<typeof createTestApp>>;

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), "extension-sync-removal-"));
  handle = await createTestApp({ storageRoot: join(root, "storage") });
});

afterAll(async () => {
  await handle?.close();
  rmSync(root, { recursive: true, force: true });
});

test("a project removed while its folder extension syncs leaves no installed source behind", async () => {
  const { deps } = handle;
  const project = await deps.projectService.create({ name: "Removed during sync" });
  const sourcePath = createTestExtensionSource({
    displayName: "Folder lab",
    installName: "folder-lab",
    name: "folder-lab",
    root: join(root, "project", ".pstdio"),
  });
  const loaded = await loadExtensionSource(sourcePath);
  // The project disappears right after the sync confirms it, as when a removal runs alongside.
  const get = deps.projectService.get;
  let removed = false;
  deps.projectService.get = async (id: string) => {
    const found = await get(id);
    if (!removed && id === project.id) {
      removed = true;
      await deps.projectService.delete(project.id);
    }
    return found;
  };
  try {
    const failed = await deps.extensionService
      .syncInstalledSourceForProject({
        displayName: loaded.metadata.displayName,
        extensionId: loaded.metadata.id,
        installName: "folder-lab",
        manifest: loaded.manifest,
        name: loaded.metadata.name,
        projectId: project.id,
        sourceHash: hashExtensionSource(sourcePath),
        sourceKind: "local_path",
        sourcePath,
        version: loaded.metadata.version ?? null,
      })
      .catch((error: Error) => error);
    expect(failed).toBeInstanceOf(ProjectNotFoundError);
  } finally {
    deps.projectService.get = get;
  }
  const installed = (await deps.installedExtensionSourcesService.list()).map((row) => row.source_path);
  expect(installed).not.toContain(sourcePath);
});

test("a project removed while a required extension attaches leaves no instance or source behind", async () => {
  const previous = { home: process.env.PSTDIO_HOME, catalog: process.env.PSTDIO_EXTENSION_CATALOG };
  process.env.PSTDIO_HOME = join(root, "required-home");
  process.env.PSTDIO_EXTENSION_CATALOG = join(root, "required-catalog.json");
  const sourcePath = join(process.env.PSTDIO_HOME, "extensions", "required-tools");
  writeExtension(sourcePath, "required-tools", "user");
  writeFileSync(
    process.env.PSTDIO_EXTENSION_CATALOG,
    JSON.stringify({
      version: 1,
      extensions: [
        {
          installName: "required-tools",
          displayName: "Required Tools",
          description: "Required by the host",
          default: false,
          alwaysEnabled: true,
          origin: { kind: "git", url: "https://example.com/tools", path: "extensions/required-tools", ref: "main" },
        },
      ],
    }),
  );
  const { deps } = handle;
  const project = await deps.projectService.create({ name: "Removed during attach" });
  const loaded = await loadExtensionSource(sourcePath);
  // The sync confirms the project, then its removal finishes before the required extension's
  // prefix check, which runs after the instance was added.
  const get = deps.projectService.get;
  let removed = false;
  deps.projectService.get = async (id: string) => {
    const found = await get(id);
    if (!removed && id === project.id) {
      removed = true;
      await deps.projectService.delete(project.id);
    }
    return found;
  };
  try {
    const failed = await deps.extensionService
      .syncInstalledSourceForProject({
        displayName: loaded.metadata.displayName,
        extensionId: loaded.metadata.id,
        installName: "required-tools",
        manifest: loaded.manifest,
        name: loaded.metadata.name,
        projectId: project.id,
        sourceHash: hashExtensionSource(sourcePath),
        sourceKind: "local_path",
        sourcePath,
        version: loaded.metadata.version ?? null,
      })
      .catch((error: Error) => error);
    expect(failed).toBeInstanceOf(ProjectNotFoundError);
  } finally {
    deps.projectService.get = get;
    if (previous.home === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previous.home;
    if (previous.catalog === undefined) delete process.env.PSTDIO_EXTENSION_CATALOG;
    else process.env.PSTDIO_EXTENSION_CATALOG = previous.catalog;
  }
  // The source goes only once no instance uses it, so this also shows the added instance was removed.
  const installed = (await deps.installedExtensionSourcesService.list()).map((row) => row.source_path);
  expect(installed).not.toContain(sourcePath);
});

test("removing the last project during discovery preserves an already installed user extension", async () => {
  const { deps } = handle;
  await handle.startupSettled;
  const project = await deps.projectService.create({ name: "Last project" });
  const sourcePath = join(process.env.PSTDIO_HOME!, "extensions", "user-tool");
  writeExtension(sourcePath, "user-tool", "user");
  const loaded = await loadExtensionSource(sourcePath);
  const source = {
    displayName: loaded.metadata.displayName,
    extensionId: loaded.metadata.id,
    installName: "user-tool",
    manifest: loaded.manifest,
    name: loaded.metadata.name,
    sourceHash: hashExtensionSource(sourcePath),
    sourcePath,
    version: loaded.metadata.version,
  };
  const registered = await deps.extensionService.registerInstalledSource(source);
  const get = deps.projectService.get;
  let removed = false;
  deps.projectService.get = async (id) => {
    const found = await get(id);
    if (!removed && id === project.id) {
      removed = true;
      const response = await handle.app.request(`/v1/projects/${id}`, { method: "DELETE" });
      expect(response.status).toBe(204);
    }
    return found;
  };
  try {
    await expectRejection(
      deps.extensionService.syncInstalledSourceForProject({ ...source, projectId: project.id }),
    ).toBeInstanceOf(ProjectNotFoundError);
  } finally {
    deps.projectService.get = get;
  }
  expect(await get(project.id)).toBeNull();
  expect(await deps.installedExtensionSourcesService.get(registered.id)).toMatchObject({ source_path: sourcePath });
});
