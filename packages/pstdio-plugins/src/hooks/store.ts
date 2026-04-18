import type { FSWatcher } from "node:fs";
import { existsSync, watch } from "node:fs";
import { join } from "node:path";
import type { PstdioClient } from "@pstdio/sdk/client";
import { createPluginRegistry } from "../registry";
import { createHookDispatcher } from "./dispatcher";
import { loadPluginRuntime, type PluginRuntime } from "./runtime";

const createEmptyRuntime = (client: PstdioClient, projectId: string): PluginRuntime => {
  const registry = createPluginRegistry([]);
  const dispatcher = createHookDispatcher();

  return {
    repoPath: null,
    client,
    projectId,
    plugins: [],
    hooks: {
      firePre: (hookName, ctx) => dispatcher.firePreHook(hookName, ctx),
      firePost: (hookName, ctx) => dispatcher.firePostHook(hookName, ctx),
    },
    actions: {
      list: (targetType) => registry.getActions(targetType),
      get: (namespacedKey) => registry.getAction(namespacedKey),
    },
    schedules: {
      list: () => [],
      get: () => undefined,
    },
    startScheduler() {},
    stopScheduler: async () => {},
  };
};

export const createPluginRuntimeStore = (input: {
  resolveRepoPath(projectId: string): Promise<string | null>;
  createClient(): PstdioClient;
  ensureWorkspace?: (pstdioDir: string) => Promise<void>;
}) => {
  const cache = new Map<string, PluginRuntime>();
  const watchers = new Map<string, FSWatcher>();

  const stopWatching = (projectId: string) => {
    watchers.get(projectId)?.close();
    watchers.delete(projectId);
  };

  const watchPluginsDir = (projectId: string, pluginsDir: string) => {
    stopWatching(projectId);
    if (!existsSync(pluginsDir)) return;

    const watcher = watch(pluginsDir, { recursive: true }, async () => {
      if (watchers.get(projectId) !== watcher) return;

      const cached = cache.get(projectId);
      if (cached) {
        await cached.stopScheduler();
      }

      cache.delete(projectId);
      stopWatching(projectId);
    });

    watcher.on("error", () => {
      if (watchers.get(projectId) !== watcher) return;
      stopWatching(projectId);
    });

    watchers.set(projectId, watcher);
  };

  const loadForProject = async (projectId: string): Promise<PluginRuntime> => {
    const repoPath = await input.resolveRepoPath(projectId);
    if (!repoPath) return createEmptyRuntime(input.createClient(), projectId);

    const pluginsDir = join(repoPath, ".pstdio", "plugins");
    const runtime = await loadPluginRuntime({
      repoPath,
      client: input.createClient(),
      projectId,
      ensureWorkspace: input.ensureWorkspace,
    });

    runtime.startScheduler();
    watchPluginsDir(projectId, pluginsDir);
    return runtime;
  };

  return {
    async getForProject(projectId: string): Promise<PluginRuntime> {
      const cached = cache.get(projectId);
      if (cached) return cached;

      const runtime = await loadForProject(projectId);
      cache.set(projectId, runtime);
      return runtime;
    },

    async invalidate(projectId: string) {
      const cached = cache.get(projectId);
      if (cached) {
        await cached.stopScheduler();
      }

      cache.delete(projectId);
      stopWatching(projectId);
    },

    async dispose() {
      for (const [projectId, runtime] of cache) {
        await runtime.stopScheduler();
        stopWatching(projectId);
      }
      cache.clear();
    },
  };
};
