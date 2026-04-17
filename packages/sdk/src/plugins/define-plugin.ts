import type { PluginDefinition } from "./types";

const assertActionTriggers = (plugin: PluginDefinition) => {
  for (const action of plugin.actions ?? []) {
    if (typeof action.trigger !== "function") {
      throw new Error(`Action "${action.key}" is missing trigger(ctx)`);
    }
  }
};

const assertSchedules = (plugin: PluginDefinition) => {
  const seen = new Set<string>();

  for (const schedule of plugin.schedules ?? []) {
    if (typeof schedule.name !== "string" || schedule.name.length === 0) {
      throw new Error("Schedule name must be a non-empty string");
    }

    if (typeof schedule.trigger !== "function") {
      throw new Error(`Schedule "${schedule.name}" is missing trigger(ctx)`);
    }

    if (seen.has(schedule.name)) {
      throw new Error(`Duplicate schedule name "${schedule.name}"`);
    }
    seen.add(schedule.name);

    if (schedule.timeoutMs !== undefined) {
      if (typeof schedule.timeoutMs !== "number" || schedule.timeoutMs <= 0 || !Number.isFinite(schedule.timeoutMs)) {
        throw new Error(`Schedule "${schedule.name}" timeoutMs must be a positive finite number`);
      }
    }
  }
};

export const definePlugin = (plugin: PluginDefinition): PluginDefinition => {
  assertActionTriggers(plugin);
  assertSchedules(plugin);
  return plugin;
};
