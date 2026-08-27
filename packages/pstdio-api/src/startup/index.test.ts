import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createTestApp } from "../test-utils/create-test-app";
import { runStartupTasks } from ".";

const REPO_ROOT = resolve(import.meta.dir, "../../../..");

const waitFor = async (predicate: () => boolean) => {
  const deadline = Date.now() + 10_000;
  while (!predicate()) {
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
    const pstdioHome = join(tempRoot, "home-source-refresh");
    const source = resolve(REPO_ROOT, "extensions/extension-lab");
    const installed = join(pstdioHome, "extensions/extension-lab");
    cpSync(source, installed, { recursive: true });
    writeFileSync(join(installed, "README.md"), "stale extension lab");

    process.env.PSTDIO_HOME = pstdioHome;
    process.env.PSTDIO_DISABLE_EMBED_MANIFEST = "1";
    process.env.PSTDIO_DEFAULT_EXTENSIONS = JSON.stringify(["extension-lab"]);

    const { close } = await createTestApp({
      databasePath: ":memory:",
      storageRoot: join(tempRoot, "storage-source-refresh"),
    });

    await waitFor(() => readFileSync(join(installed, "README.md"), "utf8") !== "stale extension lab");
    await close();

    expect(readFileSync(join(installed, "README.md"), "utf8")).toBe(readFileSync(join(source, "README.md"), "utf8"));
  }, 40_000);

  test("tracks default extension preparation without blocking runtime readiness", async () => {
    process.env.PSTDIO_HOME = join(tempRoot, "home-background-defaults");
    process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
    const preparation = Promise.withResolvers<void>();
    let prepareCalled = false;
    let backgroundTask: Promise<void> | undefined;
    const deps = {
      projectService: { list: async () => [] },
      sessionService: { listByStatus: async () => [] },
    } as unknown as Parameters<typeof runStartupTasks>[0];

    try {
      await runStartupTasks(deps, undefined, {
        onBackgroundTask: (task) => {
          backgroundTask = task;
        },
        prepareDefaultExtensions: async () => {
          prepareCalled = true;
          await preparation.promise;
        },
      });

      expect(prepareCalled).toBe(true);
      expect(backgroundTask).toBeDefined();
      if (!backgroundTask) throw new Error("Startup did not register its background work");

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

  test("releases tracked default extension preparation when runtime startup is aborted", async () => {
    process.env.PSTDIO_HOME = join(tempRoot, "home-aborted-defaults");
    process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
    const controller = new AbortController();
    const fallback = Promise.withResolvers<void>();
    let preparationSignal: AbortSignal | undefined;
    let backgroundTask: Promise<void> | undefined;
    const deps = {
      projectService: { list: async () => [] },
      sessionService: { listByStatus: async () => [] },
    } as unknown as Parameters<typeof runStartupTasks>[0];

    try {
      await runStartupTasks(deps, controller.signal, {
        onBackgroundTask: (task) => {
          backgroundTask = task;
        },
        prepareDefaultExtensions: (signal) => {
          preparationSignal = signal;
          if (!signal) return fallback.promise;
          return new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
        },
      });

      expect(preparationSignal).toBe(controller.signal);
      expect(backgroundTask).toBeDefined();
      if (!backgroundTask) throw new Error("Startup did not register its background work");

      controller.abort();
      const closed = await Promise.race([backgroundTask.then(() => true), Bun.sleep(100).then(() => false)]);
      expect(closed).toBe(true);
    } finally {
      fallback.resolve();
    }
  });
});
