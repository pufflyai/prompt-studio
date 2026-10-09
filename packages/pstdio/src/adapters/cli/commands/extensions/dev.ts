import { existsSync } from "node:fs";
import { basename, resolve } from "node:path";
import type { InstallExtensionResponse, InstalledExtensionSource, ProjectExtensionInstance } from "@pstdio/sdk/api";
import {
  createExtensionSourceWatcher,
  extensionDependencyInputNames,
  hashExtensionDependencyInputs,
  hashExtensionSource,
} from "pstdio-extensions/authoring";
import type { Arguments, Argv } from "yargs";
import { apiClient } from "@/features/api-client";
import { findProjectRoot, readConfig } from "@/features/config/config";
import { ensureApi } from "@/features/ensure-api";
import { localExtensionSourceRequest } from "@/features/extensions/local-source-request";

export type ExtensionsDevArgs = {
  name?: string;
  source: string;
};

export const command = "dev <source>";
export const describe = "Watch and refresh a local extension source";

export const builder = (yargs: Argv) =>
  yargs
    .positional("source", {
      type: "string",
      demandOption: true,
      describe: "Local extension folder path",
    })
    .option("name", {
      type: "string",
      describe: "Development registration name",
    });

type Deps = {
  createExtensionSourceWatcher: typeof createExtensionSourceWatcher;
  cwd: () => string;
  error: (message: string) => void;
  exists: (path: string) => boolean;
  findProjectRoot: typeof findProjectRoot;
  ensureApi: typeof ensureApi;
  hashExtensionDependencyInputs: typeof hashExtensionDependencyInputs;
  hashExtensionSource: typeof hashExtensionSource;
  log: (message: string) => void;
  offSignal: (signal: NodeJS.Signals, listener: () => void) => void;
  onSignal: (signal: NodeJS.Signals, listener: () => void) => void;
  readConfig: typeof readConfig;
  install: (
    projectId: string,
    sourcePath: string,
    installName: string,
    signal: AbortSignal,
  ) => Promise<InstallExtensionResponse>;
};

type DevelopmentCycleState = {
  extensionId: string;
  lastDependencyHash: string | null;
  lastSourceHash: string | null;
};

type DevelopmentCycleInput = {
  deps: Deps;
  initial: boolean;
  installName: string;
  projectId: string;
  signal: AbortSignal;
  sourcePath: string;
  state: DevelopmentCycleState;
  stopped: () => boolean;
};

const defaultDeps: Deps = {
  createExtensionSourceWatcher,
  cwd: () => process.cwd(),
  error: console.error,
  exists: existsSync,
  findProjectRoot,
  ensureApi,
  hashExtensionDependencyInputs,
  hashExtensionSource,
  log: console.log,
  offSignal: (signal, listener) => process.off(signal, listener),
  onSignal: (signal, listener) => process.on(signal, listener),
  readConfig,
  install: async (projectId, sourcePath, installName, signal) =>
    apiClient().extensions.install(
      projectId,
      await localExtensionSourceRequest(projectId, sourcePath, { installName, force: true, development: true }),
      { signal },
    ),
};

const contributionIds = (check: InstalledExtensionSource["check"]) => {
  const ids = [
    ...check.commands,
    ...check.middlewares,
    ...check.hooks,
    ...check.schedules,
    ...check.artifactMounts,
    ...check.themes,
    ...check.fileIconThemes,
    ...check.modes,
    ...check.views,
    ...check.viewMenus,
    ...check.placements,
    ...check.resourceKinds,
    ...(check.resourceHierarchyProviders ?? []),
    ...check.navigationItems,
    ...check.navigationTrees,
    ...check.statusBarItems,
    ...check.statuses,
    ...(check.activityItems ?? []),
    ...(check.settingsSections ?? []),
    ...check.settingsPanels,
    ...(check.commandPaletteResources ?? []),
    ...check.templates,
    ...check.skills,
  ].map((entry) => entry.id);
  return [...new Set(ids)].sort();
};

const webviewIds = (check: InstalledExtensionSource["check"]) => {
  const ids = check.views.filter((entry) => entry.body.kind === "webview").map((entry) => entry.id);
  return [...new Set(ids)].sort();
};

const formatHostFailure = (extensionId: string, instance: ProjectExtensionInstance) => {
  const lines = [`refresh failed ${extensionId}`];
  const webviewId = instance.lastError?.webviewId;
  if (typeof webviewId === "string") lines.push(`webview ${webviewId}`);
  if (instance.lastError) lines.push(JSON.stringify(instance.lastError, null, 2));
  else lines.push(`status: ${instance.status}`);
  return lines.join("\n");
};

const resolveProject = (deps: Pick<Deps, "cwd" | "findProjectRoot" | "readConfig">) => {
  const root = deps.findProjectRoot(deps.cwd());
  if (!root) throw new Error("Run `pst extensions dev` inside a linked git project.");
  const projectId = deps.readConfig(root)?.project_id;
  if (!projectId) throw new Error("Run `pst projects create` or link this git project before starting extension dev.");
  return { projectId, root };
};

const reportSuccessfulRefresh = (
  deps: Pick<Deps, "log">,
  extensionId: string,
  check: InstalledExtensionSource["check"],
) => {
  deps.log(`validated ${extensionId}`);
  for (const id of contributionIds(check)) deps.log(`registered ${id}`);
  for (const id of webviewIds(check)) deps.log(`webview ${id} rebuilt`);
};

const syncDevelopmentCycle = async (input: DevelopmentCycleInput) => {
  const dependencyHash = input.deps.hashExtensionDependencyInputs(input.sourcePath);
  const sourceHash = input.deps.hashExtensionSource(input.sourcePath);
  const dependenciesChanged =
    input.state.lastDependencyHash !== null && dependencyHash !== input.state.lastDependencyHash;
  const sourceChanged = sourceHash !== input.state.lastSourceHash || dependencyHash !== input.state.lastDependencyHash;
  if (!input.initial && !sourceChanged) return null;

  if (dependenciesChanged) input.deps.log(`dependency inputs changed for ${input.installName}`);

  const { source: installed, extension: instance } = await input.deps.install(
    input.projectId,
    input.sourcePath,
    input.installName,
    input.signal,
  );
  input.state.lastDependencyHash = dependencyHash;
  input.state.lastSourceHash = sourceHash;
  return { installed, instance };
};

// A refresh either publishes a new runtime or leaves the last one running. Saying which one
// happened keeps a failed cycle from reading like a successful one that produced no output.
const reportFailedRefresh = (deps: Pick<Deps, "error">, installName: string, detail: string) => {
  deps.error(detail);
  deps.error(`no new runtime published for ${installName}`);
};

const runDevelopmentCycle = async (input: DevelopmentCycleInput) => {
  if (input.stopped()) return;

  try {
    const result = await syncDevelopmentCycle(input);
    if (!result) return;
    input.state.extensionId = result.installed.metadata.id;
    if (result.instance.status === "error" || result.instance.status === "missing") {
      reportFailedRefresh(input.deps, input.installName, formatHostFailure(input.state.extensionId, result.instance));
      return;
    }
    reportSuccessfulRefresh(input.deps, input.state.extensionId, result.installed.check);
  } catch (error) {
    if (input.stopped() && input.signal.aborted) return;
    reportFailedRefresh(input.deps, input.installName, error instanceof Error ? error.message : String(error));
  }
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<ExtensionsDevArgs>) => {
    const { projectId } = resolveProject(deps);
    await deps.ensureApi(process.env.PSTDIO_API_URL);
    const sourcePath = resolve(deps.cwd(), argv.source);
    if (!deps.exists(sourcePath)) throw new Error(`Extension source folder not found: ${sourcePath}`);
    const installName = argv.name ?? basename(sourcePath);
    const abortController = new AbortController();
    let watcher: Awaited<ReturnType<typeof createExtensionSourceWatcher>> | null = null;
    let stopRequested = false;
    const state: DevelopmentCycleState = {
      extensionId: installName,
      lastDependencyHash: null,
      lastSourceHash: null,
    };
    let cycleQueue = Promise.resolve();
    let resolveStopped: () => void = () => {};
    const stopped = new Promise<void>((resolve) => {
      resolveStopped = resolve;
    });

    const queueCycle = (initial = false) => {
      const next = cycleQueue.then(() =>
        runDevelopmentCycle({
          deps,
          initial,
          installName,
          projectId,
          signal: abortController.signal,
          sourcePath,
          state,
          stopped: () => stopRequested,
        }),
      );
      cycleQueue = next.catch(() => {});
      return next;
    };

    const stop = () => {
      if (stopRequested) return;
      stopRequested = true;
      abortController.abort();
      watcher?.dispose();
      resolveStopped();
    };

    deps.onSignal("SIGINT", stop);
    deps.onSignal("SIGTERM", stop);
    try {
      await queueCycle(true);
      if (stopRequested) return;

      watcher = await deps.createExtensionSourceWatcher({
        includeIgnoredPath: (path) => extensionDependencyInputNames.includes(path as never),
        listInstalledSources: async () => [{ install_name: installName, source_path: sourcePath }],
        onError: (error) => deps.error(error instanceof Error ? error.message : String(error)),
        onSourceChanged: () => queueCycle(),
        watchDependencies: false,
      });
      deps.log(`watching ${sourcePath}`);
      await stopped;
      await cycleQueue;
      deps.log(`stopped ${state.extensionId}`);
    } finally {
      watcher?.dispose();
      deps.offSignal("SIGINT", stop);
      deps.offSignal("SIGTERM", stop);
    }
  };

export const handler = createHandler();
