import type {
  ActionDefinition,
  ActionDescriptor,
  CommandDefinition,
  CommandDescriptor,
  CommandInput,
  PluginDefinition,
  ScheduleDefinition,
} from "@pstdio/sdk/plugins";

export type { ActionDefinition, ActionDescriptor, CommandDefinition, CommandDescriptor, PluginDefinition };

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

export type ResolvedCommand = {
  namespacedKey: string;
  pluginIdentity: string;
  descriptor: CommandDescriptor;
  run: CommandInput["run"];
};

export type ResolvedSchedule = {
  key: string;
  pluginIdentity: string;
  scheduleName: string;
  cron: string;
  timeoutMs: number;
  handler: ScheduleDefinition["handler"];
};

export type ScheduleTriggerInput = {
  schedule: ResolvedSchedule;
  projectId: string;
  scheduledFor: string;
  runId: string;
};
