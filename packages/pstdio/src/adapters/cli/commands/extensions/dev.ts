import { existsSync } from "node:fs";
import { basename, resolve } from "node:path";
import type { ProjectExtensionInstance } from "@pstdio/sdk/api";
import {
  createExtensionSourceWatcher,
  extensionDependencyInputNames,
  hashExtensionDependencyInputs,
  hashExtensionSource,
  syncExtensionDevelopmentSource,
} from "pstdio-api/extensions/extension-development";
import type { InstalledExtensionSource } from "pstdio-api/extensions/install-extension-source";
import type { Arguments, Argv } from "yargs";
import { apiClient } from "@/features/api-client";
import { findGitRoot, readConfig } from "@/features/config/config";
import { enableInstalledExtension } from "./shared";

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
  findGitRoot: typeof findGitRoot;
  hashExtensionDependencyInputs: typeof hashExtensionDependencyInputs;
  hashExtensionSource: typeof hashExtensionSource;
  log: (message: string) => void;
  offSignal: (signal: NodeJS.Signals, listener: () => void) => void;
  onSignal: (signal: NodeJS.Signals, listener: () => void) => void;
  readConfig: typeof readConfig;
  refreshDevelopmentExtension: (
    projectId: string,
    installed: InstalledExtensionSource,
  ) => Promise<ProjectExtensionInstance>;
  syncExtensionDevelopmentSource: typeof syncExtensionDevelopmentSource;
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
  repoPath: string;
  signal: AbortSignal;
  sourcePath: string;
  state: DevelopmentCycleState;
  stopped: () => boolean;
};

const refreshDevelopmentExtension = async (projectId: string, installed: InstalledExtensionSource) => {
  const client = apiClient().extensions;
  const enabled = await enableInstalledExtension(projectId, installed);
  const projectExtensions = await client.listProject(projectId);
  const instance = projectExtensions.extensions.find((candidate) => candidate.id === enabled.instanceId);
  if (!instance) throw new Error(`Extension instance not found after refresh: ${enabled.instanceId}`);
  return instance;
};

const defaultDeps: Deps = {
  createExtensionSourceWatcher,
  cwd: () => process.cwd(),
  error: console.error,
  exists: existsSync,
  findGitRoot,
  hashExtensionDependencyInputs,
  hashExtensionSource,
  log: console.log,
  offSignal: (signal, listener) => process.off(signal, listener),
  onSignal: (signal, listener) => process.on(signal, listener),
  readConfig,
  refreshDevelopmentExtension,
  syncExtensionDevelopmentSource,
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
    ...check.kanbanRenderers,
    ...(check.dataTableRenderers ?? []),
    ...check.commandPaletteResources,
    ...check.treeRenderers,
    ...check.fileRenderers,
    ...check.controlsRenderers,
    ...check.templates,
    ...check.skills,
  ].map((entry) => entry.id);
  return [...new Set(ids)].sort();
};

const webviewIds = (check: InstalledExtensionSource["check"]) => {
  const ids = [
    ...check.routes.filter((entry) => entry.webview),
    ...check.panels.filter((entry) => entry.webview),
    ...check.panels.flatMap((entry) => (entry.panelMenus ?? []).filter((menu) => menu.webview)),
    ...check.settingsPanels.filter((entry) => entry.webview),
  ].map((entry) => entry.id);
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

const resolveProject = (deps: Pick<Deps, "cwd" | "findGitRoot" | "readConfig">) => {
  const root = deps.findGitRoot(deps.cwd());
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

  const installed = await input.deps.syncExtensionDevelopmentSource({
    installName: input.installName,
    repoPath: input.repoPath,
    signal: input.signal,
    source: input.sourcePath,
  });
  const instance = await input.deps.refreshDevelopmentExtension(input.projectId, installed);
  input.state.lastDependencyHash = dependencyHash;
  input.state.lastSourceHash = sourceHash;
  return { installed, instance };
};

const runDevelopmentCycle = async (input: DevelopmentCycleInput) => {
  if (input.stopped()) return;

  try {
    const result = await syncDevelopmentCycle(input);
    if (!result) return;
    input.state.extensionId = result.installed.metadata.id;
    if (result.instance.status === "error" || result.instance.status === "missing") {
      input.deps.error(formatHostFailure(input.state.extensionId, result.instance));
      return;
    }
    reportSuccessfulRefresh(input.deps, input.state.extensionId, result.installed.check);
  } catch (error) {
    if (input.stopped() && input.signal.aborted) return;
    input.deps.error(error instanceof Error ? error.message : String(error));
  }
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<ExtensionsDevArgs>) => {
    const { projectId, root: repoPath } = resolveProject(deps);
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
          repoPath,
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
