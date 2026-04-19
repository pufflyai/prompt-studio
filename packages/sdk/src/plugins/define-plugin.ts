import type { PluginDefinition } from "./types";

const assertActionTriggers = (plugin: PluginDefinition) => {
  for (const action of plugin.actions ?? []) {
    if (typeof action.trigger !== "function") {
      throw new Error(`Action "${action.key}" is missing trigger(ctx)`);
    }
  }
};

const assertScheduleHandlers = (plugin: PluginDefinition) => {
  for (const schedule of plugin.schedules ?? []) {
    if (typeof schedule.handler !== "function") {
      throw new Error(`Schedule "${schedule.name}" is missing handler(ctx)`);
    }
  }
};

export const definePlugin = (plugin: PluginDefinition): PluginDefinition => {
  assertActionTriggers(plugin);
  assertScheduleHandlers(plugin);
  return plugin;
};
