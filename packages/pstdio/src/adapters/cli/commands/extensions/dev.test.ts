import { describe, expect, mock, test } from "bun:test";
import type { InstalledExtensionSource } from "pstdio-api/extensions/install-extension-source";
import type { Arguments } from "yargs";
import { createHandler, type ExtensionsDevArgs } from "./dev";

type ExtensionsCheckResponse = InstalledExtensionSource["check"];

const waitFor = async (predicate: () => boolean, message: string) => {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (predicate()) return;
    await Bun.sleep(1);
  }
  throw new Error(message);
};

const makeCheck = (errorCount = 0): ExtensionsCheckResponse => ({
  extensionsRoot: "/repo",
  extensionsRootExists: true,
  errorCount,
  warningCount: 0,
  extensions: [
    {
      id: "pstdio.dev-test",
      name: "dev-test",
      displayName: "Dev Test",
      sourcePath: "/repo/dev-test",
      version: "1.0.0",
    },
  ],
  commands: [{ id: "dev-test.run", extensionId: "pstdio.dev-test", title: "Run" }],
  middlewares: [],
  hooks: [],
  schedules: [],
  artifactMounts: [],
  themes: [],
  fileIconThemes: [],
  menuContributions: [],
  commandPaletteContributions: [],
  modes: [],
  panels: [],
  routes: [
    {
      id: "dev-test.overview",
      extensionId: "pstdio.dev-test",
      label: "Overview",
      path: "overview",
      webview: { entry: { kind: "package-asset", path: "./src/overview.tsx", baseUrl: "file:///repo/" } },
    },
  ],
  navigation: [],
  treeItems: [],
  settingsPanels: [],
  kanbanRenderers: [],
  dataTableRenderers: [],
  commandPaletteResources: [],
  treeRenderers: [],
  fileRenderers: [],
  controlsRenderers: [],
  keybindings: [],
  settingsDefinitions: [],
  templates: [],
  skills: [],
  diagnostics:
    errorCount === 0
      ? []
      : [
          {
            code: "extension_host_capability_missing",
            message: "Dashboard does not support the overview view.",
            severity: "error",
            extensionId: "pstdio.dev-test",
            sourcePath: "/repo/dev-test/extension.ts",
            metadata: { contributionId: "dev-test.overview", missingCapability: "workbench.routes" },
          },
        ],
  hostCompatibility: {
    status: "verified",
    host: { host: "dashboard", hostVersion: "0.25.2", capabilities: {} },
    diagnostics: [],
  },
});

const loaded = {
  definition: {},
  diagnostics: [],
  manifest: { id: "pstdio.dev-test", name: "dev-test" },
  metadata: {
    id: "pstdio.dev-test",
    name: "dev-test",
    displayName: "Dev Test",
    version: "1.0.0",
    enginesPstdio: "^1.0.0",
  },
};

const installed = {
  check: makeCheck(),
  installName: "dev-test",
  manifest: loaded.manifest,
  metadata: loaded.metadata,
  source: { kind: "local" as const, path: "/repo/dev-test", ref: undefined },
  sourceHash: "installed-source-a",
  targetPath: "/home/user/.pstdio/extensions/dev-test",
};

const argv = { _: [], $0: "pstdio", source: "./dev-test" } as Arguments<ExtensionsDevArgs>;

const createSignals = () => {
  const listeners = new Map<NodeJS.Signals, Set<() => void>>();
  return {
    emit(signal: NodeJS.Signals) {
      for (const listener of listeners.get(signal) ?? []) listener();
    },
    off(signal: NodeJS.Signals, listener: () => void) {
      listeners.get(signal)?.delete(listener);
    },
    on(signal: NodeJS.Signals, listener: () => void) {
      const registered = listeners.get(signal) ?? new Set();
      registered.add(listener);
      listeners.set(signal, registered);
    },
  };
};

const makeDeps = () => {
  const signals = createSignals();
  let reload = async () => {};
  let watcherDisposed = false;
  let sourceHash = "source-a";
  let dependencyHash = "dependencies-a";
  const logs: string[] = [];
  const errors: string[] = [];
  const refreshDevelopmentExtension = mock(async () => ({
    id: "instance-1",
    projectId: "project-1",
    extensionId: "pstdio.dev-test",
    installedExtensionId: "installed-1",
    installName: "dev-test",
    name: "dev-test",
    displayName: "Dev Test",
    sourcePath: "/repo/dev-test",
    scope: "global" as const,
    status: "loaded" as const,
    enabled: true,
    config: {},
  }));

  const deps = {
    createExtensionSourceWatcher: mock(async (input: { reloadInstalledSource: () => Promise<unknown> }) => {
      reload = async () => {
        await input.reloadInstalledSource();
      };
      return {
        dispose: () => {
          watcherDisposed = true;
        },
        refresh: async () => {},
      };
    }),
    cwd: () => "/repo",
    error: (message: string) => errors.push(message),
    exists: () => true,
    findGitRoot: () => "/repo",
    hashExtensionDependencyInputs: () => dependencyHash,
    hashExtensionSource: () => sourceHash,
    log: (message: string) => logs.push(message),
    offSignal: signals.off,
    onSignal: signals.on,
    readConfig: () => ({ project_id: "project-1" }),
    refreshDevelopmentExtension,
    syncExtensionDevelopmentSource: mock(async (_input: { signal?: AbortSignal }) => installed),
  };

  return {
    deps,
    errors,
    logs,
    reload: () => reload(),
    setDependencyHash: (value: string) => {
      dependencyHash = value;
    },
    setSourceHash: (value: string) => {
      sourceHash = value;
    },
    signals,
    refreshDevelopmentExtension,
    watcherDisposed: () => watcherDisposed,
  };
};

describe("extensions dev", () => {
  test("validates, links the source, reports contribution ids, and stops cleanly", async () => {
    const target = makeDeps();
    const handler = createHandler(target.deps as never);

    const running = handler(argv);
    await waitFor(() => target.refreshDevelopmentExtension.mock.calls.length === 1, "Initial sync did not finish.");

    expect(target.logs).toContain("validated pstdio.dev-test");
    expect(target.logs).toContain("registered dev-test.run");
    expect(target.logs).toContain("webview dev-test.overview rebuilt");
    expect(target.logs).toContain("watching /repo/dev-test");

    target.signals.emit("SIGINT");
    await running;

    expect(target.watcherDisposed()).toBe(true);
    expect(target.logs).toContain("stopped pstdio.dev-test");
  });

  test("installs only after dependency inputs change and skips unchanged watcher events", async () => {
    const target = makeDeps();
    const handler = createHandler(target.deps as never);
    const running = handler(argv);
    await waitFor(() => target.refreshDevelopmentExtension.mock.calls.length === 1, "Initial sync did not finish.");

    target.setSourceHash("source-b");
    target.setDependencyHash("dependencies-b");
    await target.reload();

    expect(target.logs).toContain("dependency inputs changed for dev-test");
    expect(target.deps.syncExtensionDevelopmentSource).toHaveBeenCalledTimes(2);
    expect(target.refreshDevelopmentExtension).toHaveBeenCalledTimes(2);

    await target.reload();
    expect(target.deps.syncExtensionDevelopmentSource).toHaveBeenCalledTimes(2);
    expect(target.refreshDevelopmentExtension).toHaveBeenCalledTimes(2);

    target.signals.emit("SIGTERM");
    await running;
  });

  test("keeps watching after validation and host build failures, then recovers", async () => {
    const target = makeDeps();
    target.deps.syncExtensionDevelopmentSource = mock()
      .mockResolvedValueOnce(installed)
      .mockRejectedValueOnce(new Error("Contribution: dev-test.overview\nMissing capability: workbench.routes"))
      .mockResolvedValueOnce(installed)
      .mockResolvedValueOnce(installed);
    target.refreshDevelopmentExtension
      .mockResolvedValueOnce({
        id: "instance-1",
        extensionId: "pstdio.dev-test",
        status: "loaded",
        lastError: null,
      } as never)
      .mockResolvedValueOnce({
        id: "instance-1",
        extensionId: "pstdio.dev-test",
        status: "error",
        lastError: {
          code: "extension_webview_build_failed",
          message: "Could not resolve missing-package",
          webviewId: "dev-test.overview",
          diagnostics: [{ file: "src/overview.tsx", line: 1 }],
        },
      } as never)
      .mockResolvedValueOnce({ id: "instance-1", extensionId: "pstdio.dev-test", status: "loaded" } as never);
    const handler = createHandler(target.deps as never);
    const running = handler(argv);
    await waitFor(() => target.refreshDevelopmentExtension.mock.calls.length === 1, "Initial sync did not finish.");

    target.setSourceHash("source-invalid");
    await target.reload();
    expect(target.errors.join("\n")).toContain("Contribution: dev-test.overview");
    expect(target.refreshDevelopmentExtension).toHaveBeenCalledTimes(1);

    target.setSourceHash("source-build-failure");
    await target.reload();
    expect(target.errors.join("\n")).toContain("dev-test.overview");
    expect(target.errors.join("\n")).toContain("Could not resolve missing-package");
    expect(target.errors.join("\n")).toContain('"line": 1');

    target.setSourceHash("source-recovered");
    await target.reload();
    expect(target.refreshDevelopmentExtension).toHaveBeenCalledTimes(3);

    target.signals.emit("SIGINT");
    await running;
  });

  test("retries unchanged inputs after a transient sync failure", async () => {
    const target = makeDeps();
    target.deps.syncExtensionDevelopmentSource = mock()
      .mockResolvedValueOnce(installed)
      .mockRejectedValueOnce(new Error("registry unavailable"))
      .mockResolvedValueOnce(installed);
    const handler = createHandler(target.deps as never);
    const running = handler(argv);
    await waitFor(() => target.refreshDevelopmentExtension.mock.calls.length === 1, "Initial sync did not finish.");

    target.setDependencyHash("dependencies-b");
    await target.reload();
    expect(target.errors).toContain("registry unavailable");

    await target.reload();
    expect(target.deps.syncExtensionDevelopmentSource).toHaveBeenCalledTimes(3);
    expect(target.refreshDevelopmentExtension).toHaveBeenCalledTimes(2);

    target.signals.emit("SIGINT");
    await running;
  });

  test("aborts an active dependency install before exiting", async () => {
    const target = makeDeps();
    let installAborted = false;
    let syncCount = 0;
    target.deps.syncExtensionDevelopmentSource = mock(async (input: { signal?: AbortSignal }) => {
      syncCount++;
      if (syncCount === 1) return installed;
      return new Promise<typeof installed>((resolve) => {
        input.signal?.addEventListener(
          "abort",
          () => {
            installAborted = true;
            resolve(installed);
          },
          { once: true },
        );
      });
    });
    const handler = createHandler(target.deps as never);
    const running = handler(argv);
    await waitFor(() => target.refreshDevelopmentExtension.mock.calls.length === 1, "Initial sync did not finish.");

    target.setSourceHash("source-b");
    target.setDependencyHash("dependencies-b");
    const reload = target.reload();
    await waitFor(() => target.deps.syncExtensionDevelopmentSource.mock.calls.length === 2, "Install did not start.");
    target.signals.emit("SIGTERM");

    await reload;
    await running;
    expect(installAborted).toBe(true);
    expect(target.watcherDisposed()).toBe(true);
  });
});
