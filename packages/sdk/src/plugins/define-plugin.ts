import type { PluginDefinition } from "./types";

const assertActionTriggers = (plugin: PluginDefinition) => {
  for (const action of plugin.actions ?? []) {
    if (typeof action.trigger !== "function") {
      throw new Error(`Action "${action.key}" is missing trigger(ctx)`);
    }
  }
};

export const definePlugin = (plugin: PluginDefinition): PluginDefinition => {
  assertActionTriggers(plugin);
  return plugin;
};
