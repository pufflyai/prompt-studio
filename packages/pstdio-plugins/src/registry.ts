import type { HookHandler } from "./hooks/dispatcher";
import type { ActionDescriptor, LoadedPlugin, ResolvedAction } from "./types";

type HookHandlerEntry = {
  pluginIdentity: string;
  handler: HookHandler;
};

export const createPluginRegistry = (plugins: LoadedPlugin[]) => {
  const actions = new Map<string, ResolvedAction>();
  const hookHandlers = new Map<string, HookHandlerEntry[]>();

  for (const plugin of plugins) {
    for (const action of plugin.definition.actions ?? []) {
      const namespacedKey = `${plugin.identity}/${action.key}`;

      if (actions.has(namespacedKey)) {
        throw new Error(`Duplicate action key "${namespacedKey}"`);
      }

      const { trigger, ...descriptor } = action;
      actions.set(namespacedKey, {
        namespacedKey,
        pluginIdentity: plugin.identity,
        descriptor: { ...descriptor, key: namespacedKey },
        trigger: trigger as ResolvedAction["trigger"],
      });
    }

    for (const [hookName, handler] of Object.entries(plugin.definition.hooks ?? {})) {
      if (typeof handler !== "function") continue;

      const list = hookHandlers.get(hookName);
      const entry: HookHandlerEntry = {
        pluginIdentity: plugin.identity,
        handler: handler as HookHandlerEntry["handler"],
      };

      if (list) {
        list.push(entry);
      } else {
        hookHandlers.set(hookName, [entry]);
      }
    }
  }

  return {
    getActions(targetType?: string): ActionDescriptor[] {
      const all = [...actions.values()].map((a) => a.descriptor);
      if (!targetType) return all;
      return all.filter((a) => a.targetType === targetType);
    },

    getAction(namespacedKey: string) {
      return actions.get(namespacedKey);
    },

    getHookHandlers(hookName: string) {
      return hookHandlers.get(hookName) ?? [];
    },
  };
};
