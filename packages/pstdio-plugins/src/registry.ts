import type { HookHandler } from "./hooks/dispatcher";
import type { ActionDescriptor, LoadedPlugin, ResolvedAction, ResolvedSchedule } from "./types";

type HookHandlerEntry = {
  pluginIdentity: string;
  handler: HookHandler;
};

const registerActions = (plugin: LoadedPlugin, actions: Map<string, ResolvedAction>) => {
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
};

const registerSchedules = (plugin: LoadedPlugin, schedules: Map<string, ResolvedSchedule>) => {
  for (const schedule of plugin.definition.schedules ?? []) {
    const compositeKey = `${plugin.identity}/${schedule.name}`;

    if (schedules.has(compositeKey)) {
      throw new Error(`Duplicate schedule key "${compositeKey}"`);
    }

    schedules.set(compositeKey, {
      compositeKey,
      pluginIdentity: plugin.identity,
      scheduleName: schedule.name,
      cron: schedule.cron,
      timeoutMs: schedule.timeoutMs,
      trigger: schedule.trigger,
    });
  }
};

const registerHooks = (plugin: LoadedPlugin, hookHandlers: Map<string, HookHandlerEntry[]>) => {
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
};

export const createPluginRegistry = (plugins: LoadedPlugin[]) => {
  const actions = new Map<string, ResolvedAction>();
  const schedules = new Map<string, ResolvedSchedule>();
  const hookHandlers = new Map<string, HookHandlerEntry[]>();

  for (const plugin of plugins) {
    registerActions(plugin, actions);
    registerSchedules(plugin, schedules);
    registerHooks(plugin, hookHandlers);
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

    getSchedules() {
      return [...schedules.values()];
    },

    getSchedule(compositeKey: string) {
      return schedules.get(compositeKey);
    },

    getHookHandlers(hookName: string) {
      return hookHandlers.get(hookName) ?? [];
    },
  };
};
