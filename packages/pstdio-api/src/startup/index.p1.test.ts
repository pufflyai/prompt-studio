import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestApp } from "../test-utils/create-test-app";
import { runStartupTasks } from ".";
import { prepareSourceRefreshFixture } from "./source-refresh-source.fixture";

const waitFor = async (predicate: () => boolean | Promise<boolean>) => {
  const deadline = Date.now() + 10_000;
  while (!(await predicate())) {
    if (Date.now() >= deadline) throw new Error("Timed out waiting for startup background work");
    await Bun.sleep(10);
  }
};

describe("startup default extensions", () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-startup-default-extensions-"));
  const previousDefaultExtensions = process.env.PSTDIO_DEFAULT_EXTENSIONS;
  const previousDisableEmbedManifest = process.env.PSTDIO_DISABLE_EMBED_MANIFEST;
  const previousPstdioHome = process.env.PSTDIO_HOME;

  const restoreEnv = () => {
    if (previousDefaultExtensions === undefined) {
      delete process.env.PSTDIO_DEFAULT_EXTENSIONS;
    } else {
      process.env.PSTDIO_DEFAULT_EXTENSIONS = previousDefaultExtensions;
    }
    if (previousPstdioHome === undefined) {
      delete process.env.PSTDIO_HOME;
    } else {
      process.env.PSTDIO_HOME = previousPstdioHome;
    }
    if (previousDisableEmbedManifest === undefined) {
      delete process.env.PSTDIO_DISABLE_EMBED_MANIFEST;
    } else {
      process.env.PSTDIO_DISABLE_EMBED_MANIFEST = previousDisableEmbedManifest;
    }
  };

  afterEach(() => {
    restoreEnv();
  });

  afterAll(() => {
    restoreEnv();
    rmSync(tempRoot, { recursive: true, force: true });
  });

  test("installs configured default extensions during startup", async () => {
    const pstdioHome = join(tempRoot, "home-defaults");
    process.env.PSTDIO_HOME = pstdioHome;
    const source = prepareSourceRefreshFixture(join(tempRoot, "default-source"));
    process.env.PSTDIO_DEFAULT_EXTENSIONS = JSON.stringify([{ source, installName: "startup-fixture" }]);

    const { close } = await createTestApp({
      databasePath: ":memory:",
      storageRoot: join(tempRoot, "storage-defaults"),
    });

    await waitFor(() => existsSync(join(pstdioHome, "extensions/startup-fixture")));
    await close();

    expect(existsSync(join(pstdioHome, "extensions/startup-fixture"))).toBe(true);
  }, 40_000);

  test("tracks default extension preparation without blocking runtime readiness", async () => {
    process.env.PSTDIO_HOME = join(tempRoot, "home-background-defaults");
    process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
    const preparation = Promise.withResolvers<void>();
    let prepareCalled = false;
    const backgroundTasks: Promise<void>[] = [];
    const deps = {
      projectService: { list: async () => [] },
      sessionService: { listActive: async () => [] },
      extensionStorageService: { convertLegacyOwners: async () => {} },
    } as unknown as Parameters<typeof runStartupTasks>[0];

    try {
      await runStartupTasks(deps, undefined, {
        onBackgroundTask: (task) => {
          backgroundTasks.push(task);
        },
        prepareDefaultExtensions: async () => {
          prepareCalled = true;
          await preparation.promise;
        },
      });

      expect(prepareCalled).toBe(true);
      expect(backgroundTasks.length).toBeGreaterThan(0);
      const backgroundTask = Promise.all(backgroundTasks);

      let backgroundSettled = false;
      void backgroundTask.then(() => {
        backgroundSettled = true;
      });
      await Bun.sleep(0);
      expect(backgroundSettled).toBe(false);

      preparation.resolve();
      await backgroundTask;
      expect(backgroundSettled).toBe(true);
    } finally {
      preparation.resolve();
    }
  });

  test("an existing project adopts the Terminal tool once and preserves disable and uninstall choices", async () => {
    process.env.PSTDIO_HOME = join(tempRoot, "home-terminal-upgrade");
    delete process.env.PSTDIO_DISABLE_EMBED_MANIFEST;
    process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
    const options = {
      databasePath: join(tempRoot, "terminal-upgrade-db"),
      storageRoot: join(tempRoot, "terminal-upgrade-storage"),
    };
    const old = await createTestApp(options);
    const project = await old.deps.projectService.create({ name: "Existing project" });
    await old.close();
    const source = prepareSourceRefreshFixture(join(tempRoot, "terminal-upgrade-source"));
    const manifestPath = join(source, "package.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    writeFileSync(manifestPath, JSON.stringify({ ...manifest, name: "pstdio-terminal", publisher: "pstdio" }));
    process.env.PSTDIO_DEFAULT_EXTENSIONS = JSON.stringify([{ source, installName: "pstdio-terminal" }]);
    const upgraded = await createTestApp(options);
    const terminalFor = async (app: typeof upgraded) =>
      (await app.deps.extensionService.listProjectExtensionInstances(project.id)).find(
        ({ installedSource }) => installedSource.extension_id === "pstdio.pstdio-terminal",
      );
    try {
      await waitFor(async () => (await terminalFor(upgraded))?.instance.enabled === true);
      await upgraded.deps.extensionService.setProjectExtensionEnabled(
        (await terminalFor(upgraded))!.instance.id,
        false,
      );
    } finally {
      await upgraded.close();
    }
    const restarted = await createTestApp(options);
    try {
      expect((await terminalFor(restarted))?.instance.enabled).toBe(false);
      await restarted.deps.extensionService.uninstallProjectExtension({
        projectId: project.id,
        instanceId: (await terminalFor(restarted))!.instance.id,
      });
    } finally {
      await restarted.close();
    }
    const afterUninstall = await createTestApp(options);
    try {
      const background: Promise<void>[] = [];
      await runStartupTasks(afterUninstall.deps, undefined, { onBackgroundTask: (task) => background.push(task) });
      await Promise.all(background);
      expect(await terminalFor(afterUninstall)).toBeUndefined();
      expect(await afterUninstall.deps.extensionService.getInstalledSource("pstdio-terminal")).toBeNull();
      expect(existsSync(join(process.env.PSTDIO_HOME!, "extensions", "pstdio-terminal"))).toBe(false);
    } finally {
      await afterUninstall.close();
    }
  });

  test("releases tracked default extension preparation when runtime startup is aborted", async () => {
    process.env.PSTDIO_HOME = join(tempRoot, "home-aborted-defaults");
    process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
    const controller = new AbortController();
    const fallback = Promise.withResolvers<void>();
    let preparationSignal: AbortSignal | undefined;
    const backgroundTasks: Promise<void>[] = [];
    const deps = {
      projectService: { list: async () => [] },
      sessionService: { listActive: async () => [] },
      extensionStorageService: { convertLegacyOwners: async () => {} },
    } as unknown as Parameters<typeof runStartupTasks>[0];

    try {
      await runStartupTasks(deps, controller.signal, {
        onBackgroundTask: (task) => {
          backgroundTasks.push(task);
        },
        prepareDefaultExtensions: (signal) => {
          preparationSignal = signal;
          if (!signal) return fallback.promise;
          return new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
        },
      });

      expect(preparationSignal).toBe(controller.signal);
      expect(backgroundTasks.length).toBeGreaterThan(0);
      const backgroundTask = Promise.all(backgroundTasks);

      controller.abort();
      const closed = await Promise.race([backgroundTask.then(() => true), Bun.sleep(100).then(() => false)]);
      expect(closed).toBe(true);
    } finally {
      fallback.resolve();
    }
  });
});
