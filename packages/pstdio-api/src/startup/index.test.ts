import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { legacyTemplateOwnerSourcePath } from "pstdio-db";
import { installExtensionSource } from "../features/extensions/install-extension-source";
import { createTestApp } from "../test-utils/create-test-app";
import { repairLegacyTemplateOwners, runStartupTasks } from ".";

const REPO_ROOT = resolve(import.meta.dir, "../../../..");
const MIGRATIONS_ROOT = join(REPO_ROOT, "packages/pstdio-db/drizzle");

const createPreExtensionTemplateDatabase = async (root: string, storagePath: string) => {
  const databasePath = join(root, "database");
  const migrationsPath = join(root, "old-migrations");
  mkdirSync(databasePath);
  mkdirSync(join(migrationsPath, "meta"), { recursive: true });
  const journal = JSON.parse(readFileSync(join(MIGRATIONS_ROOT, "meta/_journal.json"), "utf8")) as {
    entries: Array<{ tag: string }>;
  };
  journal.entries = journal.entries.slice(0, 11);
  writeFileSync(join(migrationsPath, "meta/_journal.json"), JSON.stringify(journal));
  for (const entry of journal.entries) {
    cpSync(join(MIGRATIONS_ROOT, `${entry.tag}.sql`), join(migrationsPath, `${entry.tag}.sql`));
  }

  const pglite = new PGlite(databasePath);
  await pglite.waitReady;
  await migrate(drizzle(pglite), { migrationsFolder: migrationsPath });
  await pglite.exec(`INSERT INTO projects
       (id, name, shorthand, created_at, updated_at, selected_agents)
     VALUES ('project-1', 'Legacy project', 'LEG', '2026-01-01', '2026-01-01', '[]')`);
  await pglite.query(
    `INSERT INTO files
       (id, project_id, file_name, file_kind, storage_path, mime_type, size_bytes, hash, created_at, updated_at)
     VALUES ('file-1', 'project-1', 'implement_ticket.md', 'template', $1, 'text/markdown', 24,
             'legacy-hash', '2026-01-01', '2026-01-01')`,
    [storagePath],
  );
  await pglite.exec(`INSERT INTO templates
       (id, project_id, name, template_type, file_id, is_default, created_at, updated_at, deleted_at)
     VALUES ('template-1', 'project-1', 'implement_ticket', 'prompt', 'file-1', true,
             '2026-01-01', '2026-01-01', NULL)`);
  await pglite.close();
  return databasePath;
};

const invokePlannerTemplate = (
  app: Awaited<ReturnType<typeof createTestApp>>["app"],
  command: string,
  params: unknown,
) =>
  app.request(`/v1/projects/project-1/extensions/commands/pstdio.pstdio-planner.command.templates.${command}/execute`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ params }),
  });

const waitFor = async (predicate: () => boolean) => {
  const deadline = Date.now() + 10_000;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error("Timed out waiting for startup background work");
    await Bun.sleep(10);
  }
};

const assertExistingProjectSourceRefresh = async (tempRoot: string) => {
  const root = join(tempRoot, "existing-project-source-refresh");
  const pstdioHome = join(root, "home");
  const databasePath = join(root, "database");
  const storageRoot = join(root, "storage");
  const source = resolve(REPO_ROOT, "extensions/extension-lab");
  const installed = join(pstdioHome, "extensions/extension-lab");

  await installExtensionSource({
    source,
    installName: "extension-lab",
    env: { ...process.env, PSTDIO_HOME: pstdioHome },
  });
  expect(existsSync(join(installed, "node_modules/@pstdio/sdk/package.json"))).toBe(true);

  process.env.PSTDIO_HOME = pstdioHome;
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  const initial = await createTestApp({ databasePath, storageRoot });
  await initial.deps.projectService.create({ name: "Existing project" });
  await initial.close();

  writeFileSync(join(installed, "README.md"), "stale extension lab");
  process.env.PSTDIO_DISABLE_EMBED_MANIFEST = "1";
  process.env.PSTDIO_DEFAULT_EXTENSIONS = JSON.stringify([{ source, installName: "extension-lab", force: true }]);

  const restarted = await createTestApp({ databasePath, storageRoot });
  try {
    await waitFor(() => readFileSync(join(installed, "README.md"), "utf8") !== "stale extension lab");
    expect(readFileSync(join(installed, "README.md"), "utf8")).toBe(readFileSync(join(source, "README.md"), "utf8"));
  } finally {
    await restarted.close();
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
    process.env.PSTDIO_DEFAULT_EXTENSIONS = JSON.stringify([
      { source, installName: "extension-lab", skipInstall: true, force: true },
    ]);

    const { close } = await createTestApp({
      databasePath: ":memory:",
      storageRoot: join(tempRoot, "storage-source-refresh"),
    });

    await waitFor(() => readFileSync(join(installed, "README.md"), "utf8") !== "stale extension lab");
    await close();

    expect(readFileSync(join(installed, "README.md"), "utf8")).toBe(readFileSync(join(source, "README.md"), "utf8"));
  }, 40_000);

  test("refreshes local default extensions when an existing project starts in source mode", async () => {
    await assertExistingProjectSourceRefresh(tempRoot);
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

  test("repairs a pre-extension template owner and keeps its content editable through extension commands", async () => {
    const root = join(tempRoot, "legacy-template-upgrade");
    const pstdioHome = join(root, "home");
    const storageRoot = join(root, "storage");
    const legacyFile = join(root, "implement_ticket.md");
    mkdirSync(root, { recursive: true });
    writeFileSync(legacyFile, "Legacy template content\n");
    const databasePath = await createPreExtensionTemplateDatabase(root, legacyFile);
    process.env.PSTDIO_HOME = pstdioHome;
    process.env.PSTDIO_DISABLE_EMBED_MANIFEST = "1";

    const handle = await createTestApp({ databasePath, storageRoot });
    try {
      let read: Response | undefined;
      for (let attempt = 0; attempt < 80; attempt += 1) {
        read = await invokePlannerTemplate(handle.app, "read", { name: "implement-ticket" });
        if (read.status === 200) break;
        await Bun.sleep(50);
      }
      const failure = read?.status === 200 ? null : await read?.clone().json();
      expect({ failure, status: read?.status }).toEqual({
        failure: null,
        status: 200,
      });
      expect(await read?.json()).toMatchObject({
        outcome: { value: { content: "Legacy template content\n", name: "implement-ticket", type: "prompt" } },
      });

      const saved = await invokePlannerTemplate(handle.app, "save", {
        name: "implement-ticket",
        title: "Implement ticket",
        type: "prompt",
        content: "Updated after migration\n",
      });
      expect(saved.status).toBe(200);
      expect(await saved.json()).toMatchObject({ outcome: { value: { content: "Updated after migration\n" } } });

      const instances = await handle.deps.extensionService.listProjectExtensionInstances("project-1");
      expect(
        instances.filter(
          ({ installedSource, instance }) =>
            installedSource.extension_id === "pstdio.pstdio-planner" && instance.enabled,
        ),
      ).toHaveLength(1);
    } finally {
      await handle.close();
    }
  }, 40_000);

  test("keeps a legacy template owner available for retry when its extension install fails", async () => {
    const sourcePath = legacyTemplateOwnerSourcePath("pstdio.pstdio-planner");
    let registered = false;

    await expect(
      repairLegacyTemplateOwners(
        {
          installedExtensionSourcesService: {
            list: async () => [
              {
                extension_id: "pstdio.pstdio-planner",
                install_name: "pstdio-planner",
                source_path: sourcePath,
              },
            ],
          },
          extensionService: {
            registerInstalledSource: async () => {
              registered = true;
            },
          },
          extensionUpgradeService: { releaseRef: undefined },
        } as never,
        async () => {
          throw new Error("catalog unavailable");
        },
      ),
    ).resolves.toBeUndefined();

    expect(registered).toBe(false);
    expect(sourcePath).toBe(legacyTemplateOwnerSourcePath("pstdio.pstdio-planner"));
  });
});
