import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestApp } from "../../test-utils/create-test-app";
import { folderProjectInput } from "../../test-utils/folder-project-input";
import { enqueueCatalogExtensions } from "./catalog-installation";
import { writeExtension } from "./default-extensions-test-fixtures";
import { packagedExtensionCatalog } from "./extension-catalog";

test("catalog selection uses its configured catalog identity without evaluating unrelated installed code", async () => {
  const root = await mkdtemp(join(tmpdir(), "onboarding-selected-tool-"));
  const previous = {
    home: process.env.PSTDIO_HOME,
    defaults: process.env.PSTDIO_DEFAULT_EXTENSIONS,
    catalog: process.env.PSTDIO_EXTENSION_CATALOG,
  };
  process.env.PSTDIO_HOME = join(root, "home");
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  writeExtension(join(root, "home/extensions/harness-codex"), "custom-codex");
  process.env.PSTDIO_EXTENSION_CATALOG = join(root, "catalog.json");
  await writeFile(
    process.env.PSTDIO_EXTENSION_CATALOG,
    JSON.stringify({
      version: 1,
      extensions: packagedExtensionCatalog.extensions.map((entry) =>
        entry.installName === "harness-codex" ? { ...entry, extensionId: "pstdio.custom-codex" } : entry,
      ),
    }),
  );
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const gate = Bun.serve({
    port: 0,
    async fetch() {
      entered.resolve();
      await release.promise;
      return new Response("ready");
    },
  });
  const handle = await createTestApp({ databasePath: ":memory:", storageRoot: join(root, "storage") });
  try {
    const created = await handle.app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(folderProjectInput({ name: "Selected tool" })),
    });
    expect(created.status).toBe(201);
    const project = await created.json();
    const unrelated = join(root, "home/extensions/unrelated");
    writeExtension(unrelated, "unrelated");
    await writeFile(
      join(unrelated, "extension.ts"),
      `await fetch(${JSON.stringify(gate.url.href)}); export default {};`,
    );
    await enqueueCatalogExtensions(handle.deps.extensionInstallations, ["harness-codex"], project.id);
    const job = handle.deps.extensionInstallations.list().find((job) => job.projectId === project.id)!;
    expect(job.extensionId).toBe("pstdio.custom-codex");
    const completed = handle.deps.extensionInstallations.wait(job.id);
    expect(await Promise.race([completed.then(() => "enabled"), entered.promise.then(() => "unrelated")])).toBe(
      "enabled",
    );
    const extensions = await handle.deps.extensionService.listProjectExtensionInstances(project.id);
    expect(
      extensions.find(({ installedSource }) => installedSource.extension_id === "pstdio.custom-codex")?.instance
        .enabled,
    ).toBe(true);
  } finally {
    release.resolve();
    await handle.close();
    gate.stop(true);
    if (previous.home === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previous.home;
    if (previous.defaults === undefined) delete process.env.PSTDIO_DEFAULT_EXTENSIONS;
    else process.env.PSTDIO_DEFAULT_EXTENSIONS = previous.defaults;
    if (previous.catalog === undefined) delete process.env.PSTDIO_EXTENSION_CATALOG;
    else process.env.PSTDIO_EXTENSION_CATALOG = previous.catalog;
    await rm(root, { recursive: true, force: true });
  }
});

test("explicit catalog selection again re-enables a harness after its completed installation was disabled", async () => {
  const root = await mkdtemp(join(tmpdir(), "onboarding-resubmission-"));
  const previous = { home: process.env.PSTDIO_HOME, defaults: process.env.PSTDIO_DEFAULT_EXTENSIONS };
  process.env.PSTDIO_HOME = join(root, "home");
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  writeExtension(join(root, "home/extensions/harness-codex"), "harness-codex");
  const handle = await createTestApp({ databasePath: ":memory:", storageRoot: join(root, "storage") });
  try {
    const created = await handle.app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(folderProjectInput({ name: "Reselect harness" })),
    });
    expect(created.status).toBe(201);
    const project = await created.json();
    const choose = async () => {
      await enqueueCatalogExtensions(handle.deps.extensionInstallations, ["harness-codex"], project.id);
      await Promise.all(
        handle.deps.extensionInstallations
          .list()
          .filter((job) => job.projectId === project.id)
          .map((job) => handle.deps.extensionInstallations.wait(job.id)),
      );
    };
    const selected = async () =>
      (await handle.deps.extensionService.listProjectExtensionInstances(project.id)).find(
        ({ installedSource }) => installedSource.extension_id === "pstdio.harness-codex",
      )!.instance;
    await choose();
    expect((await selected()).enabled).toBe(true);
    const disabled = await handle.app.request(`/v1/projects/${project.id}/extensions/${(await selected()).id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: false }),
    });
    expect(disabled.status).toBe(200);
    expect((await selected()).enabled).toBe(false);
    await choose();
    expect((await selected()).enabled).toBe(true);
  } finally {
    await handle.close();
    if (previous.home === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previous.home;
    if (previous.defaults === undefined) delete process.env.PSTDIO_DEFAULT_EXTENSIONS;
    else process.env.PSTDIO_DEFAULT_EXTENSIONS = previous.defaults;
    await rm(root, { recursive: true, force: true });
  }
});
