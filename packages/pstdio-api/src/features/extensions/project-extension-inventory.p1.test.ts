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

test("inventory change checks leave a live frontend continuation admitted and still detect unadopted edits", async () => {
  const root = await mkdtemp(join(tmpdir(), "extension-inventory-admission-"));
  const previous = { home: process.env.PSTDIO_HOME, defaults: process.env.PSTDIO_DEFAULT_EXTENSIONS };
  process.env.PSTDIO_HOME = join(root, "home");
  process.env.PSTDIO_DEFAULT_EXTENSIONS = JSON.stringify(["pstdio-base-themes"]);
  const source = join(root, "home/extensions/pstdio-base-themes");
  writeExtension(source, "pstdio-base-themes");
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
    expect(
      (await inventory).extensions.find((entry) => entry.installName === "pstdio-base-themes")?.updateAvailable,
    ).toBe(true);
    expect((await inventory).extensions[0]).toMatchObject({
      status: "error",
      lastError: { message: "Current frontend diagnostic" },
    });
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
