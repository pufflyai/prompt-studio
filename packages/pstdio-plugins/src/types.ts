import type { ActionDefinition, ActionDescriptor, PluginDefinition, ScheduleDefinition } from "@pstdio/sdk/plugins";

export type { ActionDefinition, ActionDescriptor, PluginDefinition };

export type LoadedPlugin = {
  identity: string;
  filePath: string;
  definition: PluginDefinition;
};

export type ResolvedAction = {
  namespacedKey: string;
  pluginIdentity: string;
  descriptor: ActionDescriptor;
  trigger: ActionDefinition["trigger"];
};

export type ResolvedSchedule = {
  compositeKey: string;
  pluginIdentity: string;
  scheduleName: string;
  cron: string;
  timeoutMs?: number;
  trigger: ScheduleDefinition["trigger"];
};
