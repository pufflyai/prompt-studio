import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { withBackgroundPreparation } from "pstdio-extensions";
import { withPreparationContinuation } from "pstdio-extensions/preparation-client";
import { createTestApp } from "../../test-utils/create-test-app";
import { folderProjectInput } from "../../test-utils/folder-project-input";
import { writeExtension } from "./default-extensions-test-fixtures";
import { listProjectExtensionInventory } from "./project-extension-inventory";

test("existing projects can choose a shared installed tool before background discovery attaches it", async () => {
  const root = await mkdtemp(join(tmpdir(), "extension-inventory-shared-"));
  const previous = { home: process.env.PSTDIO_HOME, defaults: process.env.PSTDIO_DEFAULT_EXTENSIONS };
  process.env.PSTDIO_HOME = join(root, "home");
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  const handle = await createTestApp({ databasePath: ":memory:", storageRoot: join(root, "storage") });
  try {
    const first = await handle.deps.projectService.create({ name: "Installed here" });
    const second = await handle.deps.projectService.create({ name: "Choose later" });
    const sourcePath = join(root, "home/extensions/shared-tool");
    const repoPath = join(root, "repo/.pstdio/extensions/private-tool");
    writeExtension(sourcePath, "shared-tool");
    writeExtension(repoPath, "private-tool");
    const register = (path: string, name: string) =>
      handle.deps.installedExtensionSourcesService.register({
        install_name: name,
        extension_id: `pstdio.${name}`,
        display_name: name,
        source_path: path,
        source_kind: "local_path",
        manifest_json: {},
        status: "loaded",
        version: "1.0.0",
      });
    const shared = await register(sourcePath, "shared-tool");
    await register(repoPath, "private-tool");
    await register(join(root, "home/extensions/removed-tool"), "removed-tool");
    await handle.deps.extensionService.attachRegisteredSourceForProject({
      projectId: first.id,
      installedSourceId: shared.id,
    });
    const firstInstance = (await handle.deps.extensionService.listProjectExtensionInstances(first.id))[0]!;
    await handle.deps.extensionService.setProjectExtensionEnabled(firstInstance.instance.id, true);

    const inventory = await listProjectExtensionInventory(handle.deps, second.id);
    expect(inventory.extensions.map((entry) => entry.extensionId)).toEqual(["pstdio.shared-tool"]);
    expect(inventory.extensions[0]?.enabled).toBe(false);
    const again = await listProjectExtensionInventory(handle.deps, second.id);
    expect(again.extensions).toHaveLength(1);
    expect(again.extensions[0]?.id).toBe(inventory.extensions[0]?.id);
    expect((await listProjectExtensionInventory(handle.deps, first.id)).extensions[0]?.enabled).toBe(true);
  } finally {
    await handle.close();
    if (previous.home === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previous.home;
    if (previous.defaults === undefined) delete process.env.PSTDIO_DEFAULT_EXTENSIONS;
    else process.env.PSTDIO_DEFAULT_EXTENSIONS = previous.defaults;
    await rm(root, { recursive: true, force: true });
  }
});

test("inventory change checks leave a live frontend continuation admitted and still detect unadopted edits", async () => {
  const root = await mkdtemp(join(tmpdir(), "extension-inventory-admission-"));
  const previous = { home: process.env.PSTDIO_HOME, defaults: process.env.PSTDIO_DEFAULT_EXTENSIONS };
  process.env.PSTDIO_HOME = join(root, "home");
  process.env.PSTDIO_DEFAULT_EXTENSIONS = JSON.stringify(["base-themes"]);
  const source = join(root, "home/extensions/base-themes");
  writeExtension(source, "base-themes");
  let handle: Awaited<ReturnType<typeof createTestApp>> | undefined;
  const release = Promise.withResolvers<void>();
  let continuation: Promise<unknown> | undefined;
  let inventory: ReturnType<typeof listProjectExtensionInventory> | undefined;
  try {
    handle = await createTestApp({ databasePath: ":memory:", storageRoot: join(root, "storage") });
    const response = await handle.app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(folderProjectInput({ name: "Inventory" })),
    });
    expect(response.status).toBe(201);
    const { id } = (await response.json()) as { id: string };
    await writeFile(join(source, "edited.txt"), "unadopted edit");
    continuation = withPreparationContinuation(() => withBackgroundPreparation(() => release.promise));
    inventory = listProjectExtensionInventory(handle.deps, id);
    expect(await Promise.race([inventory.then(() => "interrupted"), Bun.sleep(100).then(() => "admitted")])).toBe(
      "admitted",
    );
    const [{ installedSource }] = await handle.deps.extensionService.listProjectExtensionInstances(id);
    await handle.deps.installedExtensionSourcesService.updateLoadState(installedSource!.id, {
      status: "error",
      last_error_json: { message: "Current frontend diagnostic" },
    });
    release.resolve();
    expect((await inventory).extensions.find((entry) => entry.installName === "base-themes")?.updateAvailable).toBe(
      true,
    );
    expect((await inventory).extensions[0]).toMatchObject({
      status: "error",
      lastError: { message: "Current frontend diagnostic" },
    });
    const cancelled = new AbortController();
    cancelled.abort(new Error("Inventory request closed"));
    await expect(listProjectExtensionInventory(handle.deps, id, cancelled.signal)).rejects.toThrow(
      "Inventory request closed",
    );
  } finally {
    release.resolve();
    await continuation;
    await inventory;
    await handle?.close();
    if (previous.home === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previous.home;
    if (previous.defaults === undefined) delete process.env.PSTDIO_DEFAULT_EXTENSIONS;
    else process.env.PSTDIO_DEFAULT_EXTENSIONS = previous.defaults;
    await rm(root, { recursive: true, force: true });
  }
});
