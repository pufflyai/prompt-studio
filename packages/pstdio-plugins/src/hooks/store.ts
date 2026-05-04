import type { FSWatcher } from "node:fs";
import { existsSync, watch } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { PstdioClient } from "@pstdio/sdk/client";
import { createPluginRegistry } from "../registry";
import { createHookDispatcher } from "./dispatcher";
import { loadPluginRuntime, type PluginRuntime } from "./runtime";

const RELOAD_DEBOUNCE_MS = 100;

const createEmptyRuntime = (client: PstdioClient): PluginRuntime => {
  const registry = createPluginRegistry([]);
  const dispatcher = createHookDispatcher();

  return {
    repoPath: null,
    client,
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
      list: () => registry.getSchedules(),
      get: (key) => registry.getSchedule(key),
      trigger: async () => {},
    },
  };
};

export type PluginRuntimeStore = {
  getForProject(projectId: string): Promise<PluginRuntime>;
  subscribe(fn: (projectId: string) => void): () => void;
  invalidate(projectId: string): void;
  dispose(): void;
};

export const createPluginRuntimeStore = (input: {
  resolveRepoPath(projectId: string): Promise<string | null>;
  createClient(): PstdioClient;
  ensureWorkspace?: (pstdioDir: string) => Promise<void>;
  onError?: (projectId: string, err: unknown) => void;
}): PluginRuntimeStore => {
  const cache = new Map<string, PluginRuntime>();
  const loading = new Map<string, Promise<PluginRuntime>>();
  const watchers = new Map<string, FSWatcher>();
  const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const subscribers = new Set<(projectId: string) => void>();

  const notify = (projectId: string) => {
    for (const fn of subscribers) {
      try {
        fn(projectId);
      } catch (err) {
        input.onError?.(projectId, err);
      }
    }
  };

  const stopWatching = (projectId: string) => {
    watchers.get(projectId)?.close();
    watchers.delete(projectId);

    const timer = debounceTimers.get(projectId);
    if (timer) {
      clearTimeout(timer);
      debounceTimers.delete(projectId);
    }
  };

  const scheduleReload = (projectId: string) => {
    const existing = debounceTimers.get(projectId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      debounceTimers.delete(projectId);
      void reloadForProject(projectId);
    }, RELOAD_DEBOUNCE_MS);
    timer.unref?.();
    debounceTimers.set(projectId, timer);
  };

  const watchPluginsDir = (projectId: string, pluginsDir: string) => {
    const previous = watchers.get(projectId);
    if (previous) previous.close();
    if (!existsSync(pluginsDir)) {
      watchers.delete(projectId);
      return;
    }

    const watcher = watch(pluginsDir, { recursive: true }, () => {
      if (watchers.get(projectId) !== watcher) return;
      cache.delete(projectId);
      scheduleReload(projectId);
    });

    watcher.on("error", () => {
      if (watchers.get(projectId) !== watcher) return;
      stopWatching(projectId);
    });

    // Leaked watchers shouldn't keep the event loop alive: tests that forget
    // to dispose would otherwise hang CI.
    watcher.unref?.();
    watchers.set(projectId, watcher);
  };

  const loadForProject = async (projectId: string) => {
    const repoPath = await input.resolveRepoPath(projectId);
    if (!repoPath) return createEmptyRuntime(input.createClient());

    const pluginsDir = join(repoPath, ".pstdio", "plugins");
    await mkdir(pluginsDir, { recursive: true });
    const runtime = await loadPluginRuntime({
      repoPath,
      client: input.createClient(),
      ensureWorkspace: input.ensureWorkspace,
    });

    watchPluginsDir(projectId, pluginsDir);
    return runtime;
  };

  const storeRuntime = (projectId: string, runtime: PluginRuntime) => {
    const shouldCache = runtime.repoPath === null || runtime.plugins.length > 0;

    if (shouldCache) {
      cache.set(projectId, runtime);
      return true;
    }

    cache.delete(projectId);
    return false;
  };

  const reloadForProject = async (projectId: string) => {
    const pending = loading.get(projectId);
    if (pending) {
      // Coalesce with any in-flight load; trigger a follow-up reload after it.
      await pending.catch(() => undefined);
    }

    const load = loadForProject(projectId);
    loading.set(projectId, load);

    try {
      const runtime = await load;
      if (loading.get(projectId) === load) {
        storeRuntime(projectId, runtime);
      }
      notify(projectId);
    } catch (err) {
      input.onError?.(projectId, err);
    } finally {
      if (loading.get(projectId) === load) {
        loading.delete(projectId);
      }
    }
  };

  const ensureLoaded = (projectId: string) => {
    const cached = cache.get(projectId);
    if (cached) return Promise.resolve(cached);

    const pending = loading.get(projectId);
    if (pending) return pending;

    const load = loadForProject(projectId)
      .then((runtime) => {
        if (loading.get(projectId) === load) {
          if (storeRuntime(projectId, runtime)) {
            notify(projectId);
          }
        }

        return runtime;
      })
      .finally(() => {
        if (loading.get(projectId) === load) {
          loading.delete(projectId);
        }
      });

    loading.set(projectId, load);
    return load;
  };

  return {
    getForProject(projectId) {
      return ensureLoaded(projectId);
    },

    subscribe(fn) {
      subscribers.add(fn);
      return () => {
        subscribers.delete(fn);
      };
    },

    invalidate(projectId) {
      loading.delete(projectId);
      cache.delete(projectId);
      stopWatching(projectId);
    },

    dispose() {
      loading.clear();
      for (const [projectId] of watchers) {
        stopWatching(projectId);
      }
      for (const [, timer] of debounceTimers) {
        clearTimeout(timer);
      }
      debounceTimers.clear();
      subscribers.clear();
      cache.clear();
    },
  };
};
