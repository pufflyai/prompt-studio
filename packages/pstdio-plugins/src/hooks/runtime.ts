import { join } from "node:path";
import type { PstdioClient } from "@pstdio/sdk/client";
import type { PostPluginHooks, PrePluginHooks } from "@pstdio/sdk/plugins";
import { loadPlugins } from "../loader";
import { createPluginRegistry } from "../registry";
import type { ActionDescriptor, ResolvedAction, ResolvedSchedule, ScheduleTriggerInput } from "../types";
import { createHookDispatcher, type HookHandler, type PostHookErrorReporter, type PreHookResult } from "./dispatcher";

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
  plugins: PluginInfo[];
  hooks: HookRuntime;
  actions: {
    list(targetType?: string): ActionDescriptor[];
    get(namespacedKey: string): ResolvedAction | undefined;
  };
  schedules: {
    list(): ResolvedSchedule[];
    get(key: string): ResolvedSchedule | undefined;
    trigger(input: ScheduleTriggerInput): Promise<void>;
  };
};

export const loadPluginRuntime = async (input: {
  repoPath: string;
  client: PstdioClient;
  ensureWorkspace?: (pstdioDir: string) => Promise<void>;
  onPostHookError?: PostHookErrorReporter;
}): Promise<PluginRuntime> => {
  const { repoPath, client, ensureWorkspace } = input;
  const pstdioDir = join(repoPath, ".pstdio");
  const pluginsDir = join(pstdioDir, "plugins");

  if (ensureWorkspace) {
    await ensureWorkspace(pstdioDir);
  }

  const plugins = await loadPlugins(pluginsDir);
  const registry = createPluginRegistry(plugins);
  const dispatcher = createHookDispatcher({ onPostHookError: input.onPostHookError });

  for (const plugin of plugins) {
    for (const [hookName, handler] of Object.entries(plugin.definition.hooks ?? {})) {
      if (typeof handler === "function") {
        dispatcher.register(hookName, handler as HookHandler);
      }
    }
  }

  return {
    repoPath,
    client,
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
      list: () => registry.getSchedules(),
      get: (key) => registry.getSchedule(key),
      trigger: async (input) => {
        const triggerContext = {
          client,
          projectId: input.projectId,
          trigger: { type: "schedule" as const },
          scheduleName: input.schedule.scheduleName,
          scheduledFor: input.scheduledFor,
          runId: input.runId,
        };

        await input.schedule.handler(triggerContext);
      },
    },
  };
};
