import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
import { createExtensionRootWatcher } from "./extension-root-watcher";
import { EXTENSION_INSTALLING_MARKER, resolvePstdioHome } from "./install-extension-source";
import { createInstalledExtensionRuntime, selectExistingSources } from "./installed-extension-runtime";

const wait = () => new Promise((resolve) => setTimeout(resolve, 0));
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const waitFor = async (predicate: () => boolean | Promise<boolean>) => {
  for (let attempt = 0; attempt < 50; attempt++) {
    if (await predicate()) return;
    await delay(10);
  }

  throw new Error("Timed out waiting for runtime assertion.");
};

type Listener = (eventType: string, filename: string | Buffer | null) => void;

class FakeWatcher {
  closed = false;
  listener: Listener;

  constructor(listener: Listener) {
    this.listener = listener;
  }

  close() {
    this.closed = true;
  }
}

const createProcess = (onRefresh?: (sourcePath?: string) => Promise<void>) => ({
  dispose: () => {},
  refresh: onRefresh ?? (async () => {}),
});

// Shared no-op deps: these tests exercise watcher wiring, not harness or catalog behavior.
const noopRuntimeDeps = {
  harnessRegistry: {} as never,
  projectRuntimeCatalog: { invalidate: () => {} } as never,
};

const writeExtension = (dir: string, name: string) => {
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({
      name,
      version: "1.0.0",
      displayName: name,
      publisher: "pstdio",
      main: "./extension.ts",
      engines: { pstdio: "^1.0.0" },
    }),
  );
  writeFileSync(join(dir, "extension.ts"), "export default {};\n");
};

describe("selectExistingSources", () => {
  test("does not watch or build an installed source while it is being replaced", () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-installing-runtime-source-"));
    const readySource = join(root, "ready");
    const installingSource = join(root, "installing");
    mkdirSync(readySource);
    mkdirSync(installingSource);
    writeFileSync(join(installingSource, EXTENSION_INSTALLING_MARKER), "");

    try {
      expect(selectExistingSources([{ source_path: readySource }, { source_path: installingSource }])).toEqual([
        { source_path: readySource },
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("createInstalledExtensionRuntime", () => {
  test("lets the extension service own runtime refresh after a watched source reload", async () => {
    let reloadInstalledSource: ((sourcePath: string) => Promise<unknown>) | undefined;
    let resolveSourceReload: (() => void) | undefined;
    let webviewRefreshCount = 0;
    const refreshedSourcePaths: Array<string | undefined> = [];
    const sourceReload = new Promise<void>((resolve) => {
      resolveSourceReload = resolve;
    });

    const runtime = await createInstalledExtensionRuntime({
      ...noopRuntimeDeps,
      extensionService: {
        reloadInstalledSourceBySourcePath: async () => sourceReload,
        reportBuildFailure: async () => {},
        reportBuildSuccess: async () => {},
      } as never,
      installedExtensionSourcesService: { list: async () => [] } as never,
      projectService: { list: async () => [] } as never,
      repoService: {} as never,
      webviewBuilds: true,
      createRootWatcher: async () => createProcess(),
      createSourceWatcher: async (config) => {
        reloadInstalledSource = config.reloadInstalledSource;
        return createProcess();
      },
      createWebviewBuildManager: () =>
        createProcess(async (sourcePath) => {
          webviewRefreshCount += 1;
          refreshedSourcePaths.push(sourcePath);
        }),
    });

    try {
      const reload = reloadInstalledSource?.("/extensions/lab");
      await wait();

      expect(webviewRefreshCount).toBe(1);
      expect(refreshedSourcePaths).toEqual([undefined]);

      resolveSourceReload?.();
      await reload;
      await wait();
      expect(refreshedSourcePaths).toEqual([undefined]);
    } finally {
      runtime.dispose();
    }
  });

  test("does not wait for webview builds when refreshing after source changes", async () => {
    let resolveBackgroundBuild: (() => void) | undefined;
    let webviewRefreshCount = 0;
    const backgroundBuild = new Promise<void>((resolve) => {
      resolveBackgroundBuild = resolve;
    });

    const runtime = await createInstalledExtensionRuntime({
      ...noopRuntimeDeps,
      extensionService: {
        reportBuildFailure: async () => {},
        reportBuildSuccess: async () => {},
      } as never,
      installedExtensionSourcesService: { list: async () => [] } as never,
      projectService: { list: async () => [] } as never,
      repoService: {} as never,
      webviewBuilds: true,
      createRootWatcher: async () => createProcess(),
      createSourceWatcher: async () => createProcess(),
      createWebviewBuildManager: () =>
        createProcess(async () => {
          webviewRefreshCount += 1;
          if (webviewRefreshCount === 1) return;
          await backgroundBuild;
        }),
    });

    const refresh = runtime.refresh();
    await wait();

    expect(webviewRefreshCount).toBe(2);
    await expect(refresh).resolves.toBeUndefined();

    resolveBackgroundBuild?.();
    await wait();
    runtime.dispose();
  });

  test("watches the user extension root and every linked repo extension root", async () => {
    let listExtensionRoots: (() => Promise<Array<{ path: string }>>) | undefined;

    const runtime = await createInstalledExtensionRuntime({
      ...noopRuntimeDeps,
      extensionService: {} as never,
      installedExtensionSourcesService: { list: async () => [] } as never,
      projectService: { list: async () => [{ id: "project-a" }] } as never,
      repoService: { listByProject: async () => [{ path: "/repos/alpha" }] } as never,
      webviewBuilds: false,
      createRootWatcher: async (config) => {
        listExtensionRoots = config.listExtensionRoots as never;
        return createProcess();
      },
      createSourceWatcher: async () => createProcess(),
    });

    const roots = (await listExtensionRoots?.()) ?? [];

    expect(roots.map((root) => root.path)).toEqual([
      join(resolvePstdioHome({ env: process.env }), "extensions"),
      join("/repos/alpha", ".pstdio", "extensions"),
    ]);

    runtime.dispose();
  });

  test("starts watching a repo linked after startup even when it has no extensions", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-live-repo-link-"));
    const repoPath = join(tempRoot, "late-repo");
    const repoRoot = join(repoPath, ".pstdio", "extensions");
    let repos: Array<{ path: string }> = [];
    const watchers: Array<{ path: string; watcher: FakeWatcher }> = [];

    const runtime = await createInstalledExtensionRuntime({
      ...noopRuntimeDeps,
      extensionService: {} as never,
      installedExtensionSourcesService: { list: async () => [] } as never,
      projectService: { list: async () => [{ id: "project-a" }] } as never,
      repoService: { listByProject: async () => repos } as never,
      webviewBuilds: false,
      createRootWatcher: (config) =>
        createExtensionRootWatcher({
          ...config,
          ensureRoot: () => {},
          watch: (path, listener) => {
            const watcher = new FakeWatcher(listener);
            watchers.push({ path, watcher });
            return watcher;
          },
        }),
      createSourceWatcher: async () => createProcess(),
    });

    try {
      expect(watchers.some((entry) => entry.path === repoRoot)).toBe(false);

      repos = [{ path: repoPath }];
      await runtime.refresh();

      expect(watchers.some((entry) => entry.path === repoRoot)).toBe(true);
    } finally {
      runtime.dispose();
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test("discovers and reconciles a repo-local extension as its root folder changes after startup", async () => {
    const { db, close } = await createDb({ path: ":memory:" });
    const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-live-repo-extension-"));

    try {
      const projectService = createProjectService({ projectsDBService: createProjectsDBService(db) });
      const installedExtensionSourcesService = createInstalledExtensionSourcesDBService(db);
      const extensionInstancesService = createExtensionInstancesDBService(db);

      let refreshRuntime = async () => {};
      let sourceRefreshes = 0;
      const extensionService = createExtensionService({
        extensionInstancesService,
        installedExtensionSourcesService,
        extensionUserDataService: createExtensionUserDataDBService(db),
        projectService,
        onInstalledSourcesChanged: () => refreshRuntime(),
      });

      const project = await projectService.create({ name: "Live Repo" });
      const repoPath = join(tempRoot, "repo");
      const repoRoot = join(repoPath, ".pstdio", "extensions");
      const sourcePath = join(repoRoot, "repo-tool");
      const watchers: Array<{ path: string; watcher: FakeWatcher }> = [];

      const runtime = await createInstalledExtensionRuntime({
        ...noopRuntimeDeps,
        extensionService,
        installedExtensionSourcesService,
        projectService,
        repoService: { listByProject: async () => [{ path: repoPath }] } as never,
        webviewBuilds: false,
        createRootWatcher: (config) =>
          createExtensionRootWatcher({
            ...config,
            debounceMs: 5,
            ensureRoot: () => {},
            watch: (path, listener) => {
              const watcher = new FakeWatcher(listener);
              watchers.push({ path, watcher });
              return watcher;
            },
          }),
        createSourceWatcher: async () =>
          createProcess(async () => {
            sourceRefreshes += 1;
          }),
      });
      refreshRuntime = runtime.refresh;

      try {
        const sourceRefreshesAfterStartup = sourceRefreshes;
        writeExtension(sourcePath, "repo-tool");

        const repoWatcher = watchers.find((entry) => entry.path === repoRoot);
        expect(repoWatcher).toBeDefined();
        repoWatcher?.watcher.listener("rename", "repo-tool");

        await waitFor(async () => Boolean(await installedExtensionSourcesService.getBySourcePath(sourcePath)));

        const installed = await installedExtensionSourcesService.getBySourcePath(sourcePath);
        const instances = await extensionInstancesService.list({ scope_id: project.id, scope_type: "project" });

        expect(installed).toMatchObject({ install_name: "repo-tool", source_kind: "local_path", status: "loaded" });
        expect(instances).toHaveLength(1);
        expect(instances[0]?.enabled).toBe(true);
        expect(sourceRefreshes).toBeGreaterThan(sourceRefreshesAfterStartup);

        const sourceRefreshesAfterDiscovery = sourceRefreshes;
        rmSync(sourcePath, { recursive: true, force: true });
        repoWatcher?.watcher.listener("rename", "repo-tool");

        await waitFor(
          async () => (await installedExtensionSourcesService.getBySourcePath(sourcePath))?.status === "missing",
        );

        const [reconciled] = await extensionInstancesService.list({ scope_id: project.id, scope_type: "project" });
        expect(reconciled?.enabled).toBe(false);
        expect(sourceRefreshes).toBeGreaterThan(sourceRefreshesAfterDiscovery);
      } finally {
        runtime.dispose();
      }
    } finally {
      await close();
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
