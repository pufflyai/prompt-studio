import { join } from "node:path";
import type { PstdioClient } from "@pstdio/sdk/client";
import type { PostPluginHooks, PrePluginHooks } from "@pstdio/sdk/plugins";
import { loadPlugins } from "../loader";
import { createPluginRegistry } from "../registry";
import type { ActionDescriptor, ResolvedAction } from "../types";
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
  plugins: PluginInfo[];
  hooks: HookRuntime;
  actions: {
    list(targetType?: string): ActionDescriptor[];
    get(namespacedKey: string): ResolvedAction | undefined;
  };
};

export const loadPluginRuntime = async (input: {
  repoPath: string;
  client: PstdioClient;
  ensureWorkspace?: (pstdioDir: string) => Promise<void>;
}): Promise<PluginRuntime> => {
  const { repoPath, client, ensureWorkspace } = input;
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
  };
};
