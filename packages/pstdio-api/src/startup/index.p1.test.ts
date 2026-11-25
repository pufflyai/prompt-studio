import { afterAll, afterEach, describe, expect, spyOn, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeExtension } from "../features/extensions/default-extensions-test-fixtures";
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
      extensionStorageService: {},
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

  test.each([
    false,
    true,
  ])("continues other projects after Workspaces recovery fails (prepared: %s)", async (prepared) => {
    process.env.PSTDIO_HOME = join(tempRoot, `home-workspace-list-failure-${prepared}`);
    process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
    delete process.env.PSTDIO_DISABLE_EMBED_MANIFEST;
    const { deps, close } = await createTestApp({
      databasePath: join(tempRoot, `workspace-list-db-${prepared}`),
      storageRoot: join(tempRoot, `workspace-list-storage-${prepared}`),
    });
    const first = await deps.projectService.create({ name: "Unavailable project" });
    const second = await deps.projectService.create({ name: "Healthy project" });
    const list = spyOn(deps.workspaceService, "listForProviderReconciliation").mockImplementation(async (projectId) => {
      if (projectId === first.id) throw new Error("Workspace listing unavailable");
      return [];
    });
    const activate = spyOn(deps.extensionRuntimeCatalog, "activate");
    const background: Promise<void>[] = [];
    try {
      await runStartupTasks(deps, undefined, {
        ...(prepared ? { prepareDefaultExtensions: async () => {} } : {}),
        recoverOrphanedSessions: async () => {},
        onBackgroundTask: (task) => {
          background.push(task);
          void task.catch(() => {});
        },
      });
      await Promise.all(background);
      expect(activate.mock.calls.map(([projectId]) => projectId)).toContain(second.id);
    } finally {
      list.mockRestore();
      activate.mockRestore();
      await close();
    }
  });

  test("an existing project adopts Terminal once and preserves disable and uninstall choices", async () => {
    const name = "pstdio-terminal";
    process.env.PSTDIO_HOME = join(tempRoot, `home-${name}-upgrade`);
    delete process.env.PSTDIO_DISABLE_EMBED_MANIFEST;
    process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
    const options = {
      databasePath: join(tempRoot, `${name}-upgrade-db`),
      storageRoot: join(tempRoot, `${name}-upgrade-storage`),
    };
    const old = await createTestApp(options);
    const project = await old.deps.projectService.create({ name: "Existing project" });
    await old.close();
    const source = prepareSourceRefreshFixture(join(tempRoot, `${name}-upgrade-source`));
    const manifestPath = join(source, "package.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    writeFileSync(manifestPath, JSON.stringify({ ...manifest, name, publisher: "pstdio" }));
    process.env.PSTDIO_DEFAULT_EXTENSIONS = JSON.stringify([{ source, installName: name }]);
    const upgraded = await createTestApp(options);
    const toolFor = async (app: typeof upgraded) =>
      (await app.deps.extensionService.listProjectExtensionInstances(project.id)).find(
        ({ installedSource }) => installedSource.extension_id === `pstdio.${name}`,
      );
    try {
      await waitFor(async () => (await toolFor(upgraded))?.instance.enabled === true);
      await upgraded.deps.extensionService.setProjectExtensionEnabled((await toolFor(upgraded))!.instance.id, false);
    } finally {
      await upgraded.close();
    }
    const restarted = await createTestApp(options);
    try {
      expect((await toolFor(restarted))?.instance.enabled).toBe(false);
      await restarted.deps.extensionService.uninstallProjectExtension({
        projectId: project.id,
        instanceId: (await toolFor(restarted))!.instance.id,
      });
    } finally {
      await restarted.close();
    }
    const afterUninstall = await createTestApp(options);
    try {
      const background: Promise<void>[] = [];
      await runStartupTasks(afterUninstall.deps, undefined, { onBackgroundTask: (task) => background.push(task) });
      await Promise.all(background);
      expect(await toolFor(afterUninstall)).toBeUndefined();
      expect(await afterUninstall.deps.extensionService.getInstalledSource(name)).toBeNull();
      expect(existsSync(join(process.env.PSTDIO_HOME!, "extensions", name))).toBe(false);
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
      extensionStorageService: {},
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

test("activates surviving projects after a project is removed during user extension discovery", async () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-startup-remove-during-discovery-"));
  const previousHome = process.env.PSTDIO_HOME;
  process.env.PSTDIO_HOME = join(tempRoot, "home");
  const sourcePath = join(process.env.PSTDIO_HOME, "extensions", "user-tool");
  writeExtension(sourcePath, "user-tool", "user");
  const { deps, close, startupSettled } = await createTestApp();
  const background: Promise<void>[] = [];
  try {
    await startupSettled;
    const removed = await deps.projectService.create({ name: "Removed project" });
    const surviving = await deps.projectService.create({ name: "Surviving project" });

    const activated: string[] = [];
    const unsubscribe = deps.extensionRuntimeCatalog.subscribeActivation((id) => activated.push(id));
    const startupDeps = {
      ...deps,
      extensionService: {
        ...deps.extensionService,
        syncInstalledSourceForProject: async (
          input: Parameters<typeof deps.extensionService.syncInstalledSourceForProject>[0],
        ) => {
          if (input.projectId === removed.id) await deps.projectService.delete(removed.id);
          return deps.extensionService.syncInstalledSourceForProject(input);
        },
      },
    };
    try {
      await runStartupTasks(startupDeps, undefined, {
        prepareDefaultExtensions: async () => {},
        recoverOrphanedSessions: async () => {},
        onBackgroundTask: (task) => {
          background.push(task);
          void task.catch(() => {});
        },
      });
      await Promise.all(background);
      expect(await deps.projectService.get(removed.id)).toBeNull();
      expect(activated).toEqual([surviving.id]);
      const instances = await deps.extensionService.listProjectExtensionInstances(surviving.id);
      expect(instances.map(({ installedSource }) => installedSource.source_path)).toContain(sourcePath);
    } finally {
      unsubscribe();
    }
  } finally {
    await Promise.allSettled(background);
    await close();
    if (previousHome === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previousHome;
    rmSync(tempRoot, { recursive: true, force: true });
  }
});
