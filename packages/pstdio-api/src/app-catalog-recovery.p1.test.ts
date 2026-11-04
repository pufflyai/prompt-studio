import { expect, spyOn, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as domain from "./app-domain-services";
import * as extensions from "./app-extension-services";
import { writeExtension } from "./features/extensions/default-extensions-test-fixtures";
import { createTestApp } from "./test-utils/create-test-app";

test("restored catalog work completes after deferred app dependencies are ready", async () => {
  const root = await mkdtemp(join(tmpdir(), "catalog-app-recovery-"));
  const previous = { home: process.env.PSTDIO_HOME, defaults: process.env.PSTDIO_DEFAULT_EXTENSIONS };
  process.env.PSTDIO_HOME = root;
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  const storageRoot = join(root, "storage");
  const databasePath = join(root, "database");
  const source = join(root, "extensions", "pstdio-base-themes");
  writeExtension(source, "pstdio-base-themes");
  let handle: Awaited<ReturnType<typeof createTestApp>> | undefined;
  const release = Promise.withResolvers<void>();
  const entered = Promise.withResolvers<void>();
  const createSettings = domain.createAppSettingsService;
  const wire = extensions.wireAppExtensionServices;
  let services: ReturnType<typeof wire> | undefined;
  let settingsSpy: ReturnType<typeof spyOn> | undefined;
  let wiringSpy: ReturnType<typeof spyOn> | undefined;
  let opening: ReturnType<typeof createTestApp> | undefined;
  const id = "restored-catalog";
  try {
    handle = await createTestApp({ databasePath, storageRoot });
    const project = await handle.deps.projectService.create({ name: "Recovered project" });
    await handle.deps.extensionService.enableInstalledSourceForProject({
      projectId: project.id,
      installName: "pstdio-base-themes",
      extensionId: "pstdio.pstdio-base-themes",
      displayName: "Themes",
      name: "pstdio-base-themes",
      sourcePath: source,
      manifest: {},
    });
    await handle.close();
    handle = undefined;
    await writeFile(
      join(storageRoot, "extension-installations.json"),
      JSON.stringify([
        {
          job: {
            id,
            installName: "pstdio-base-themes",
            displayName: "Themes",
            projectId: project.id,
            extensionId: "pstdio.pstdio-base-themes",
            status: "queued",
            queuedAt: new Date().toISOString(),
          },
          request: { kind: "catalog", name: "pstdio-base-themes" },
        },
      ]),
    );
    settingsSpy = spyOn(domain, "createAppSettingsService").mockImplementation(async (input) => {
      entered.resolve();
      await release.promise;
      return createSettings(input);
    });
    wiringSpy = spyOn(extensions, "wireAppExtensionServices").mockImplementation((input) => {
      services = wire(input);
      return services;
    });
    opening = createTestApp({ databasePath, storageRoot });
    await entered.promise;
    // If recovery started early, let that real queued job reach its completion before app construction resumes.
    if (services) await services.extensionInstallations.wait(id).catch(() => {});
    release.resolve();
    handle = await opening;
    await handle.deps.extensionInstallations.wait(id);
    expect(handle.deps.extensionInstallations.list()).toContainEqual(
      expect.objectContaining({ id, status: "completed" }),
    );
    expect((await handle.deps.extensionService.listProjectExtensionInstances(project.id))[0]?.instance.enabled).toBe(
      true,
    );
  } finally {
    release.resolve();
    if (!handle && opening) handle = await opening.catch(() => undefined);
    await handle?.close();
    settingsSpy?.mockRestore();
    wiringSpy?.mockRestore();
    if (previous.home === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previous.home;
    if (previous.defaults === undefined) delete process.env.PSTDIO_DEFAULT_EXTENSIONS;
    else process.env.PSTDIO_DEFAULT_EXTENSIONS = previous.defaults;
    await rm(root, { recursive: true, force: true });
  }
});
