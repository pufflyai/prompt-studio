import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createOnboarding } from "../features/onboarding/onboarding";
import { createTestApp } from "../test-utils/create-test-app";
import { runBunScenario } from "../test-utils/run-bun-scenario";
import { runStartupTasks } from ".";

const REPO_ROOT = resolve(import.meta.dir, "../../../..");

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
  const previousCatalog = process.env.PSTDIO_EXTENSION_CATALOG;

  const restoreEnv = () => {
    if (previousCatalog === undefined) delete process.env.PSTDIO_EXTENSION_CATALOG;
    else process.env.PSTDIO_EXTENSION_CATALOG = previousCatalog;
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
    process.env.PSTDIO_DEFAULT_EXTENSIONS = JSON.stringify([
      { source: resolve(REPO_ROOT, "extensions/extension-lab"), installName: "extension-lab", skipInstall: true },
      {
        source: resolve(REPO_ROOT, "extensions/pstdio-base-themes"),
        installName: "pstdio-base-themes",
        skipInstall: true,
      },
    ]);

    const { close } = await createTestApp({
      databasePath: ":memory:",
      storageRoot: join(tempRoot, "storage-defaults"),
    });

    await waitFor(() => existsSync(join(pstdioHome, "extensions/extension-lab")));
    await waitFor(() => existsSync(join(pstdioHome, "extensions/pstdio-base-themes")));
    await close();

    expect(existsSync(join(pstdioHome, "extensions/extension-lab"))).toBe(true);
    expect(existsSync(join(pstdioHome, "extensions/pstdio-base-themes"))).toBe(true);
  }, 40_000);

  test("refreshes local default extensions when running from source", async () => {
    await runBunScenario(join(import.meta.dir, "source-refresh.fixture.ts"), ["fresh"]);
  }, 40_000);

  test("refreshes local default extensions when an existing project starts in source mode", async () => {
    await runBunScenario(join(import.meta.dir, "source-refresh.fixture.ts"), ["existing"]);
  }, 40_000);

  test("adds a newly required default to existing projects", async () => {
    const root = join(tempRoot, "existing-project-default");
    const source = join(root, "source");
    mkdirSync(source, { recursive: true });
    writeFileSync(
      join(source, "package.json"),
      JSON.stringify({
        name: "required-tool",
        publisher: "example",
        version: "1.0.0",
        main: "extension.ts",
        engines: { pstdio: `^${EXTENSION_API_VERSION}` },
        pstdio: { scope: "user" },
      }),
    );
    writeFileSync(join(source, "extension.ts"), "export default { views: [] };");
    process.env.PSTDIO_HOME = join(root, "home");
    process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
    delete process.env.PSTDIO_DISABLE_EMBED_MANIFEST;
    const options = { databasePath: join(root, "database"), storageRoot: join(root, "storage") };
    const initial = await createTestApp(options);
    const project = await initial.deps.projectService.create({ name: "Existing project" });
    await initial.close();
    process.env.PSTDIO_EXTENSION_CATALOG = join(root, "catalog.json");
    writeFileSync(
      process.env.PSTDIO_EXTENSION_CATALOG,
      JSON.stringify({
        version: 1,
        extensions: [
          {
            installName: "required-tool",
            extensionId: "example.required-tool",
            displayName: "Required tool",
            description: "",
            default: true,
            alwaysEnabled: true,
            origin: {
              kind: "git",
              url: "https://github.com/example/tools",
              path: "extensions/required-tool",
              ref: "main",
            },
          },
        ],
      }),
    );
    process.env.PSTDIO_DEFAULT_EXTENSIONS = JSON.stringify([
      { source, installName: "required-tool", skipInstall: true },
    ]);
    const restarted = await createTestApp(options);
    try {
      await waitFor(async () =>
        (await restarted.deps.extensionService.listProjectExtensionInstances(project.id)).some(
          ({ installedSource, instance }) =>
            installedSource.extension_id === "example.required-tool" && instance.enabled,
        ),
      );
      const extensions = await restarted.deps.extensionService.listProjectExtensionInstances(project.id);
      expect(extensions).toContainEqual(
        expect.objectContaining({
          installedSource: expect.objectContaining({ extension_id: "example.required-tool" }),
          instance: expect.objectContaining({ enabled: true }),
        }),
      );
    } finally {
      await restarted.close();
    }
  });

  test("tracks default extension preparation without blocking runtime readiness", async () => {
    process.env.PSTDIO_HOME = join(tempRoot, "home-background-defaults");
    process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
    const preparation = Promise.withResolvers<void>();
    let prepareCalled = false;
    const backgroundTasks: Promise<void>[] = [];
    const deps = {
      onboarding: { resume: async () => {} },
      projectService: { list: async () => [] },
      sessionService: { listActive: async () => [] },
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

  test("recovers sessions and prepares defaults when saved onboarding cannot be read", async () => {
    const path = join(tempRoot, "invalid-onboarding.json");
    writeFileSync(path, "{unfinished");
    const recovered: string[] = [];
    const background: Promise<void>[] = [];
    const deps = {
      onboarding: createOnboarding({ path, enqueue: () => {} }),
      projectService: { list: async () => [] },
    } as unknown as Parameters<typeof runStartupTasks>[0];
    await runStartupTasks(deps, undefined, {
      onBackgroundTask: (task) => background.push(task),
      prepareDefaultExtensions: async () => {
        recovered.push("defaults");
      },
      recoverQueuedSessions: async () => {
        recovered.push("sessions");
      },
      recoverQueuedAutomation: async () => {
        recovered.push("automation");
      },
      recoverOrphanedSessions: async () => {
        recovered.push("orphans");
      },
    });
    await Promise.all(background);
    expect(recovered).toEqual(["defaults", "sessions", "orphans", "automation"]);
    expect(await Bun.file(path).text()).toBe("{unfinished");
  });

  test("releases tracked default extension preparation when runtime startup is aborted", async () => {
    process.env.PSTDIO_HOME = join(tempRoot, "home-aborted-defaults");
    process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
    const controller = new AbortController();
    const fallback = Promise.withResolvers<void>();
    let preparationSignal: AbortSignal | undefined;
    const backgroundTasks: Promise<void>[] = [];
    const deps = {
      onboarding: { resume: async () => {} },
      projectService: { list: async () => [] },
      sessionService: { listActive: async () => [] },
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
