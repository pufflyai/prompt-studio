import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hashExtensionSource, loadExtensionSource } from "../features/extensions/extension-runtime";
import { createTestExtensionSource } from "../features/extensions/test-utils/create-test-extension-source";
import { createTestApp } from "../test-utils/create-test-app";
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
