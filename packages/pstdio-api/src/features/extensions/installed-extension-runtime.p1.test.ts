import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
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
import { createExtensionRootWatcher } from "./extension-root-watcher";
import { EXTENSION_INSTALLING_MARKER, resolvePstdioHome } from "./install-extension-source";
import { createInstalledExtensionRuntime, selectExistingSources } from "./installed-extension-runtime";

const wait = () => new Promise((resolve) => setTimeout(resolve, 0));

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
  adopt: async () => {},
  ensure: async () => {},
  dispose: () => {},
  refresh: onRefresh ?? (async () => {}),
});

// Shared no-op deps: these tests exercise watcher wiring, not harness or catalog behavior.
const noopRuntimeDeps = {
  harnessRegistry: {} as never,
  projectRuntimeCatalog: { invalidate: () => {} } as never,
  provisionWorkspacesUsingSource: async () => {},
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
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
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
  test("does not wait for webview builds when refreshing after source changes", async () => {
    let resolveBackgroundBuild: (() => void) | undefined;
    let webviewRefreshCount = 0;
    const backgroundBuild = new Promise<void>((resolve) => {
      resolveBackgroundBuild = resolve;
    });

    const runtime = createInstalledExtensionRuntime({
      ...noopRuntimeDeps,
      extensionService: {
        reportBuildFailure: async () => {},
        reportBuildSuccess: async () => {},
      } as never,
      installedExtensionSourcesService: { list: async () => [] } as never,
      projectService: { list: async () => [] } as never,
      workspaceService: { getDefault: async () => null } as never,
      webviewBuilds: true,
      createRootWatcher: async () => createProcess(),
      createWebviewBuildManager: () =>
        createProcess(async () => {
          webviewRefreshCount += 1;
          if (webviewRefreshCount === 1) return;
          await backgroundBuild;
        }),
    });
    await runtime.ready;

    const refresh = runtime.refresh();
    await wait();

    expect(webviewRefreshCount).toBe(2);
    await expect(refresh).resolves.toBeUndefined();

    resolveBackgroundBuild?.();
    await wait();
    await runtime.dispose();
  });

  test("watches the user extension root and every project folder extension root", async () => {
    let listExtensionRoots: (() => Promise<Array<{ path: string }>>) | undefined;

    const runtime = createInstalledExtensionRuntime({
      ...noopRuntimeDeps,
      extensionService: {} as never,
      installedExtensionSourcesService: { list: async () => [] } as never,
      projectService: { list: async () => [{ id: "project-a" }] } as never,
      workspaceService: {
        getDefault: async () => ({
          id: "home",
          project_id: "project-1",
          root_path: "/repos/alpha",
          execution_kind: "local",
          provider_id: "pstdio.root",
          provider_state: "ready",
        }),
      } as never,
      webviewBuilds: false,
      createRootWatcher: async (config) => {
        listExtensionRoots = config.listExtensionRoots as never;
        return createProcess();
      },
    });
    await runtime.ready;

    const roots = (await listExtensionRoots?.()) ?? [];

    expect(roots.map((root) => root.path)).toEqual([
      join(resolvePstdioHome({ env: process.env }), "extensions"),
      join("/repos/alpha", ".pstdio", "extensions"),
    ]);

    await runtime.dispose();
  });

  test("starts watching a repo linked after startup even when it has no extensions", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-live-repo-link-"));
    const repoPath = join(tempRoot, "late-repo");
    const repoRoot = join(repoPath, ".pstdio", "extensions");
    let repos: Array<{ path: string }> = [];
    const watchers: Array<{ path: string; watcher: FakeWatcher }> = [];

    const runtime = createInstalledExtensionRuntime({
      ...noopRuntimeDeps,
      extensionService: {} as never,
      installedExtensionSourcesService: { list: async () => [] } as never,
      projectService: { list: async () => [{ id: "project-a" }] } as never,
      workspaceService: { getDefault: async () => (repos[0] ? { root_path: repos[0].path } : null) } as never,
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
    });
    await runtime.ready;

    try {
      expect(watchers.some((entry) => entry.path === repoRoot)).toBe(false);

      repos = [{ path: repoPath }];
      await runtime.refresh();

      expect(watchers.some((entry) => entry.path === repoRoot)).toBe(true);
    } finally {
      await runtime.dispose();
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test("discovers and reconciles a repo-local extension as its root folder changes after startup", async () => {
    const { db, close } = await createDb({ path: ":memory:" });
    const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-live-repo-extension-"));

    try {
      const projectService = createProjectService({
        syncService: createSyncService({ db: db }),
        eventBus: new EventBus(),
        projectsDBService: createProjectsDBService(db),
      });
      const installedExtensionSourcesService = createInstalledExtensionSourcesDBService(db);
      const extensionInstancesService = createExtensionInstancesDBService(db);

      let refreshRuntime = async () => {};
      const extensionService = createExtensionService({
        extensionInstancesService,
        installedExtensionSourcesService,
        extensionUserDataService: createExtensionUserDataDBService(db),
        recovery: { exclusive: <T>(_projectId: string, run: () => Promise<T>) => run() },
        projectService,
        onInstalledSourcesChanged: () => refreshRuntime(),
      });

      const project = await projectService.create({ name: "Live Repo" });
      const repoPath = join(tempRoot, "repo");
      const repoRoot = join(repoPath, ".pstdio", "extensions");
      const sourcePath = join(repoRoot, "repo-tool");
      const watchers: Array<{ path: string; watcher: FakeWatcher }> = [];
      let rootSyncComplete = Promise.withResolvers<void>();

      const runtime = createInstalledExtensionRuntime({
        ...noopRuntimeDeps,
        extensionService,
        installedExtensionSourcesService,
        projectService,
        workspaceService: {
          getDefault: async () => ({
            id: "home",
            project_id: "project-1",
            root_path: repoPath,
            execution_kind: "local",
            provider_id: "pstdio.root",
            provider_state: "ready",
          }),
        } as never,
        webviewBuilds: false,
        createRootWatcher: (config) =>
          createExtensionRootWatcher({
            ...config,
            listExtensionRoots: async () =>
              (await config.listExtensionRoots()).map((root) => {
                if (root.path !== repoRoot) return root;
                return {
                  ...root,
                  sync: async () => {
                    try {
                      const result = await root.sync();
                      rootSyncComplete.resolve();
                      return result;
                    } catch (error) {
                      rootSyncComplete.reject(error);
                      throw error;
                    }
                  },
                };
              }),
            debounceMs: 5,
            ensureRoot: () => {},
            watch: (path, listener) => {
              const watcher = new FakeWatcher(listener);
              watchers.push({ path, watcher });
              return watcher;
            },
          }),
      });
      await runtime.ready;
      refreshRuntime = runtime.refresh;

      try {
        writeExtension(sourcePath, "repo-tool");

        const repoWatcher = watchers.find((entry) => entry.path === repoRoot);
        expect(repoWatcher).toBeDefined();
        repoWatcher?.watcher.listener("rename", "repo-tool");

        await rootSyncComplete.promise;

        const installed = await installedExtensionSourcesService.getBySourcePath(sourcePath);
        const instances = await extensionInstancesService.list({ scope_id: project.id, scope_type: "project" });

        expect(installed).toMatchObject({ install_name: "repo-tool", source_kind: "local_path", status: "loaded" });
        expect(instances).toHaveLength(1);
        expect(instances[0]?.enabled).toBe(true);

        rootSyncComplete = Promise.withResolvers<void>();
        rmSync(sourcePath, { recursive: true, force: true });
        repoWatcher?.watcher.listener("rename", "repo-tool");

        await rootSyncComplete.promise;
        expect((await installedExtensionSourcesService.getBySourcePath(sourcePath))?.status).toBe("missing");

        const [reconciled] = await extensionInstancesService.list({ scope_id: project.id, scope_type: "project" });
        expect(reconciled?.enabled).toBe(false);
      } finally {
        await runtime.dispose();
      }
    } finally {
      await close();
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
