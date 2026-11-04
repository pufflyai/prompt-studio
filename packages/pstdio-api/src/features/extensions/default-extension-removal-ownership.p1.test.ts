import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createDb,
  createExtensionInstancesDBService,
  createExtensionUserDataDBService,
  createInstalledExtensionSourcesDBService,
  createProjectsDBService,
} from "pstdio-db";
import { createExtensionService } from "../../services/extension-service";
import { createProjectService } from "../../services/project-service";
import { createSyncService } from "../../services/sync-service";
import { EventBus } from "../sync/event-bus";
import { enqueueDefaultExtensionInstall } from "./default-extension-install-queue";
import { installMissingDefaultExtensions, resolveDefaultExtensionsConfig } from "./default-extensions";
import { writeExtension } from "./default-extensions-test-fixtures";
import { installExtensionSource, toExtensionEnableInput } from "./install-extension-source";

const withDefault = async (run: (fixture: Awaited<ReturnType<typeof createFixture>>) => Promise<void>) => {
  const root = mkdtempSync(join(tmpdir(), "default-removal-owner-"));
  const previous = { home: process.env.PSTDIO_HOME, defaults: process.env.PSTDIO_DEFAULT_EXTENSIONS };
  const database = await createDb({ path: ":memory:" });
  try {
    process.env.PSTDIO_HOME = join(root, "home");
    const source = join(root, "source");
    writeExtension(source, "example-default");
    process.env.PSTDIO_DEFAULT_EXTENSIONS = JSON.stringify([
      { source, installName: "example-default", skipInstall: true },
    ]);
    await run(await createFixture(database, root));
  } finally {
    await database.close();
    for (const [key, value] of [
      ["PSTDIO_HOME", previous.home],
      ["PSTDIO_DEFAULT_EXTENSIONS", previous.defaults],
    ]) {
      if (value === undefined) delete process.env[key!];
      else process.env[key!] = value;
    }
    rmSync(root, { recursive: true, force: true });
  }
};

const createFixture = async (database: Awaited<ReturnType<typeof createDb>>, root: string) => {
  const projectService = createProjectService({
    projectsDBService: createProjectsDBService(database.db),
    syncService: createSyncService({ db: database.db }),
    eventBus: new EventBus(),
  });
  const sources = createInstalledExtensionSourcesDBService(database.db);
  const instances = createExtensionInstancesDBService(database.db);
  let refresh = async () => {};
  const service = createExtensionService({
    projectService,
    installedExtensionSourcesService: sources,
    extensionInstancesService: instances,
    extensionUserDataService: createExtensionUserDataDBService(database.db),
    recovery: { exclusive: <T>(_id: string, run: () => Promise<T>) => run() },
    onInstalledSourcesChanged: () => refresh(),
  });
  const [installed] = await installMissingDefaultExtensions();
  const project = await projectService.create({ name: "Default owner" });
  const enabled = await service.enableInstalledSourceForProject({
    projectId: project.id,
    installName: installed!.installName,
    ...toExtensionEnableInput(installed!),
  });
  return {
    root,
    installed: installed!,
    project,
    service,
    setRefresh: (next: typeof refresh) => {
      refresh = next;
    },
    remove: () =>
      service.uninstallProjectExtension({
        projectId: project.id,
        instanceId: enabled.instance.id,
        deleteUserData: true,
      }),
  };
};

test("removing a repo copy does not suppress the shared default", () =>
  withDefault(async ({ root, installed, project, service }) => {
    const repoPath = join(root, "repo", ".pstdio", "extensions", "example-default");
    writeExtension(repoPath, "example-default", "repo");
    const repo = await service.syncInstalledSourceForProject({
      projectId: project.id,
      installName: installed.installName,
      ...toExtensionEnableInput(installed),
      sourcePath: repoPath,
    });
    await service.uninstallProjectExtension({
      projectId: project.id,
      instanceId: repo!.instance.id,
      deleteUserData: true,
    });
    expect(existsSync(installed.targetPath)).toBe(true);
    expect((await resolveDefaultExtensionsConfig()).defaultExtensions).toHaveLength(1);
  }));

test("removal survives a post-delete refresh failure", () =>
  withDefault(async ({ installed, setRefresh, remove }) => {
    setRefresh(async () => {
      throw new Error("refresh unavailable");
    });
    await expect(remove()).rejects.toThrow("refresh unavailable");
    expect(existsSync(installed.targetPath)).toBe(false);
    await installMissingDefaultExtensions();
    expect(existsSync(installed.targetPath)).toBe(false);
  }));

test("default preparation rechecks an earlier selection after removal", () =>
  withDefault(async ({ installed, remove }) => {
    const selectedBeforeRemoval = await resolveDefaultExtensionsConfig();
    await remove();
    await installMissingDefaultExtensions({ config: selectedBeforeRemoval });
    expect(existsSync(installed.targetPath)).toBe(false);
  }));

test("overlapping preparation cannot resurrect a source while removal refreshes", () =>
  withDefault(async ({ installed, setRefresh, remove }) => {
    const selectedBeforeRemoval = await resolveDefaultExtensionsConfig();
    const refreshing = Promise.withResolvers<void>();
    const releaseRefresh = Promise.withResolvers<void>();
    setRefresh(async () => {
      refreshing.resolve();
      await releaseRefresh.promise;
    });
    const removal = remove();
    await refreshing.promise;
    expect(existsSync(installed.targetPath)).toBe(false);
    const preparation = installMissingDefaultExtensions({ config: selectedBeforeRemoval });
    releaseRefresh.resolve();
    await Promise.all([removal, preparation]);
    expect(existsSync(installed.targetPath)).toBe(false);
  }));

test("an optional default later required by the catalog is restored", () =>
  withDefault(async ({ root, installed, remove }) => {
    await remove();
    const previous = process.env.PSTDIO_EXTENSION_CATALOG;
    process.env.PSTDIO_EXTENSION_CATALOG = join(root, "required-catalog.json");
    writeFileSync(
      process.env.PSTDIO_EXTENSION_CATALOG,
      JSON.stringify({
        version: 1,
        extensions: [
          {
            installName: "example-default",
            displayName: "Required default",
            description: "Required by host",
            default: true,
            alwaysEnabled: true,
            origin: {
              kind: "git",
              url: "https://example.com/repo.git",
              path: "extensions/example-default",
              ref: "main",
            },
          },
        ],
      }),
    );
    try {
      await installMissingDefaultExtensions();
      expect(existsSync(installed.targetPath)).toBe(true);
    } finally {
      if (previous === undefined) delete process.env.PSTDIO_EXTENSION_CATALOG;
      else process.env.PSTDIO_EXTENSION_CATALOG = previous;
    }
  }));

test("removal waits for an in-flight explicit physical install of the same source", () =>
  withDefault(async ({ root, installed, remove }) => {
    const packagePath = join(root, "source", "package.json");
    const manifest = await Bun.file(packagePath).json();
    writeFileSync(packagePath, JSON.stringify({ ...manifest, dependencies: { "fixture-dependency": "1.0.0" } }));
    const installing = Promise.withResolvers<void>();
    const releaseInstall = Promise.withResolvers<void>();
    const installation = installExtensionSource({
      source: join(root, "source"),
      installName: "example-default",
      force: true,
      runCommand: async () => {
        installing.resolve();
        await releaseInstall.promise;
        return { exitCode: 0, stdout: "", stderr: "" };
      },
    });
    await installing.promise;
    let removed = false;
    const removal = remove().then(() => {
      removed = true;
    });
    try {
      await Bun.sleep(0);
      expect(removed).toBe(false);
    } finally {
      releaseInstall.resolve();
    }
    await Promise.all([installation, removal]);
    expect(existsSync(installed.targetPath)).toBe(false);
    expect((await resolveDefaultExtensionsConfig()).defaultExtensions).toEqual([]);
  }));

test("an explicit install aborted while queued does not clear deliberate removal", () =>
  withDefault(async ({ root, installed, remove }) => {
    await remove();
    const release = Promise.withResolvers<void>();
    const blocked = enqueueDefaultExtensionInstall(installed.targetPath, () => release.promise);
    const controller = new AbortController();
    const installing = installExtensionSource({
      source: join(root, "source"),
      installName: "example-default",
      skipInstall: true,
      signal: controller.signal,
    });
    await Bun.sleep(0);
    controller.abort(new Error("cancelled selection"));
    release.resolve();
    await blocked;
    await expect(installing).rejects.toThrow("cancelled selection");
    expect(existsSync(installed.targetPath)).toBe(false);
    expect((await resolveDefaultExtensionsConfig()).defaultExtensions).toEqual([]);
  }));
