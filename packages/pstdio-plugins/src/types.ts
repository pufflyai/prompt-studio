import type {
  ActionDefinition,
  ActionDescriptor,
  PluginDefinition,
  ScheduledTriggerContext,
} from "@pstdio/sdk/plugins";

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

export type ScheduledTrigger = (ctx: ScheduledTriggerContext) => void | Promise<void>;

export type ResolvedSchedule = {
  namespacedKey: string;
  pluginIdentity: string;
  scheduleName: string;
  cron: string;
  timeoutSeconds: number;
  trigger: ScheduledTrigger;
};
