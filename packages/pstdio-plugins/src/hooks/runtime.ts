import { join } from "node:path";
import type { PstdioClient } from "@pstdio/sdk/client";
import type { PostPluginHooks, PrePluginHooks, ScheduledTriggerContext } from "@pstdio/sdk/plugins";
import { loadPlugins } from "../loader";
import { createPluginRegistry } from "../registry";
import type { ActionDescriptor, ResolvedAction, ResolvedSchedule } from "../types";
import { createHookDispatcher, type HookHandler, type PreHookResult } from "./dispatcher";

export type HookRuntime = {
  firePre<K extends keyof PrePluginHooks>(
    hookName: K,
    ctx: Parameters<NonNullable<PrePluginHooks[K]>>[0],
  ): Promise<PreHookResult>;
  firePost<K extends keyof PostPluginHooks>(
    hookName: K,
    ctx: Parameters<NonNullable<PostPluginHooks[K]>>[0],
  ): Promise<void>;
};

export type PluginInfo = {
  identity: string;
  filePath: string;
};

export type PluginRuntime = {
  repoPath: string | null;
  client: PstdioClient;
  projectId: string;
  plugins: PluginInfo[];
  hooks: HookRuntime;
  actions: {
    list(targetType?: string): ActionDescriptor[];
    get(namespacedKey: string): ResolvedAction | undefined;
  };
  schedules: {
    list(): ResolvedSchedule[];
    get(namespacedKey: string): ResolvedSchedule | undefined;
  };
  startScheduler(): void;
  stopScheduler(): Promise<void>;
};

type SchedulerHandle = {
  stop(): void;
};

export const loadPluginRuntime = async (input: {
  repoPath: string;
  client: PstdioClient;
  projectId: string;
  ensureWorkspace?: (pstdioDir: string) => Promise<void>;
}): Promise<PluginRuntime> => {
  const { repoPath, client, projectId, ensureWorkspace } = input;
  const pstdioDir = join(repoPath, ".pstdio");
  const pluginsDir = join(pstdioDir, "plugins");

  if (ensureWorkspace) {
    await ensureWorkspace(pstdioDir);
  }

  const plugins = await loadPlugins(pluginsDir);
  const registry = createPluginRegistry(plugins);
  const dispatcher = createHookDispatcher();

  for (const plugin of plugins) {
    for (const [hookName, handler] of Object.entries(plugin.definition.hooks ?? {})) {
      if (typeof handler === "function") {
        dispatcher.register(hookName, handler as HookHandler);
      }
    }
  }

  const schedulesList = registry.getSchedules();
  const activeRuns = new Map<string, { startTime: number }>();
  const runningHandles: SchedulerHandle[] = [];

  return {
    repoPath,
    client,
    projectId,
    plugins: plugins.map((p) => ({ identity: p.identity, filePath: p.filePath })),
    hooks: {
      firePre: (hookName, ctx) => dispatcher.firePreHook(hookName, ctx),
      firePost: (hookName, ctx) => dispatcher.firePostHook(hookName, ctx),
    },
    actions: {
      list: (targetType) => registry.getActions(targetType),
      get: (namespacedKey) => registry.getAction(namespacedKey),
    },
    schedules: {
      list: () => schedulesList,
      get: (namespacedKey) => registry.getSchedule(namespacedKey),
    },
    startScheduler() {
      if (schedulesList.length === 0) return;
      if (typeof Bun.cron !== "function") return;

      for (const schedule of schedulesList) {
        const key = schedule.namespacedKey;
        const runHandler = async () => {
          if (activeRuns.has(key)) {
            console.log(`[scheduler] skipped_overlap key=${key}`);
            return;
          }

          const runId = `${key}-${Date.now()}`;
          activeRuns.set(key, { startTime: Date.now() });

          const scheduledFor = new Date().toISOString();
          const ctx: ScheduledTriggerContext = {
            type: "schedule",
            scheduleName: schedule.scheduleName,
            scheduledFor,
            runId,
            client,
            projectId,
          };

          try {
            const timeoutMs = schedule.timeoutSeconds * 1000;
            const timeoutPromise = new Promise<void>((_, reject) => {
              setTimeout(() => reject(new Error("timeout")), timeoutMs);
            });

            const runPromise = Promise.resolve(schedule.trigger(ctx)).catch((err) => {
              console.error(`[scheduler] handler_error key=${key} error=${err.message}`);
            });

            await Promise.race([runPromise, timeoutPromise]);

            console.log(`[scheduler] completed key=${key} runId=${runId}`);
          } catch {
            console.error(`[scheduler] timed_out key=${key} runId=${runId}`);
          } finally {
            activeRuns.delete(key);
          }
        };

        const cronJob = Bun.cron(schedule.cron, runHandler);
        runningHandles.push({ stop: () => cronJob.stop() });
      }
    },
    async stopScheduler() {
      for (const handle of runningHandles) {
        handle.stop();
      }

      const timeout = 5000;
      const start = Date.now();
      while (activeRuns.size > 0 && Date.now() - start < timeout) {
        await new Promise((r) => setTimeout(r, 100));
      }

      runningHandles.length = 0;
    },
  };
};
