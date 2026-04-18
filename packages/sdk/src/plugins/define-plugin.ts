import type { PluginDefinition } from "./types";

const assertActionTriggers = (plugin: PluginDefinition) => {
  for (const action of plugin.actions ?? []) {
    if (typeof action.trigger !== "function") {
      throw new Error(`Action "${action.key}" is missing trigger(ctx)`);
    }
  }
};

const isValidCron = (cron: string): boolean => {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const pattern = /^(\*|(\d+(-\d+)?(,\d+(-\d+)?)*)|\d+\/\d+)$/;
  return parts.every((p) => pattern.test(p));
};

const assertScheduleTriggers = (plugin: PluginDefinition, identity: string) => {
  for (const schedule of plugin.schedules ?? []) {
    if (typeof schedule.trigger !== "function") {
      throw new Error(`Schedule "${schedule.name}" in plugin "${identity}" is missing trigger(ctx)`);
    }
    if (!isValidCron(schedule.cron)) {
      throw new Error(
        `Invalid cron expression "${schedule.cron}" in schedule "${schedule.name}" in plugin "${identity}". Expected 5-field cron format.`,
      );
    }
  }
};

export const definePlugin = (plugin: PluginDefinition, identity = "plugin"): PluginDefinition => {
  assertActionTriggers(plugin);
  assertScheduleTriggers(plugin, identity);
  return plugin;
};
