export type ActionDescriptor = {
  key: string;
  label: string;
  targetType: string;
  placement: string;
};

export type ActionDefinition = ActionDescriptor & {
  trigger: (ctx: unknown) => void | Promise<void>;
};

export type PluginDefinition = {
  actions?: ActionDefinition[];
  hooks?: Record<string, (...args: unknown[]) => unknown>;
};

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
