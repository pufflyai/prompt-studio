import type { FSWatcher } from "node:fs";
import { existsSync, watch } from "node:fs";
import { join } from "node:path";
import { createClient } from "@pstdio/sdk/client";
import { createHookDispatcher } from "pstdio-hooks";
import { createPluginRegistry, ensurePluginWorkspace, loadPlugins } from "pstdio-plugins";
import { registerPluginHooks } from "./register-plugin-hooks";

type PluginServiceDeps = {
  repoService: { listByProject: (projectId: string) => Promise<{ path: string }[]> };
  ensureWorkspace?: (pstdioDir: string) => Promise<void>;
};

type ProjectPlugins = {
  dispatcher: ReturnType<typeof createHookDispatcher>;
  registry: ReturnType<typeof createPluginRegistry>;
  client: ReturnType<typeof createClient>;
};

const createDefaultClient = () => createClient();

const EMPTY_PLUGINS: ProjectPlugins = {
  dispatcher: createHookDispatcher(),
  registry: createPluginRegistry([]),
  client: createDefaultClient(),
};

export const createPluginService = (deps: PluginServiceDeps) => {
  const ensureWorkspace = deps.ensureWorkspace ?? ensurePluginWorkspace;
  const cache = new Map<string, ProjectPlugins>();
  const watchers = new Map<string, FSWatcher>();

  const stopWatching = (projectId: string) => {
    watchers.get(projectId)?.close();
    watchers.delete(projectId);
  };

  const watchPluginsDir = (projectId: string, pluginsDir: string) => {
    stopWatching(projectId);
    if (!existsSync(pluginsDir)) return;

    const watcher = watch(pluginsDir, { recursive: true }, () => {
      if (watchers.get(projectId) !== watcher) return;
      cache.delete(projectId);
      stopWatching(projectId);
    });

    watcher.on("error", () => {
      if (watchers.get(projectId) !== watcher) return;
      stopWatching(projectId);
    });

    watchers.set(projectId, watcher);
  };

  const loadForProject = async (projectId: string): Promise<ProjectPlugins> => {
    const repos = await deps.repoService.listByProject(projectId);
    const repoPath = repos[0]?.path;
    if (!repoPath) return EMPTY_PLUGINS;

    const pstdioDir = join(repoPath, ".pstdio");
    const pluginsDir = join(pstdioDir, "plugins");
    await ensureWorkspace(pstdioDir);
    const plugins = await loadPlugins(pluginsDir);

    const dispatcher = createHookDispatcher();
    const registry = createPluginRegistry(plugins);
    const client = createDefaultClient();

    registerPluginHooks(plugins, dispatcher);
    watchPluginsDir(projectId, pluginsDir);

    return { dispatcher, registry, client };
  };

  return {
    async getForProject(projectId: string): Promise<ProjectPlugins> {
      const cached = cache.get(projectId);
      if (cached) return cached;

      const result = await loadForProject(projectId);
      cache.set(projectId, result);
      return result;
    },

    invalidate(projectId: string) {
      cache.delete(projectId);
      stopWatching(projectId);
    },

    dispose() {
      for (const [projectId] of watchers) {
        stopWatching(projectId);
      }
      cache.clear();
    },
  };
};
