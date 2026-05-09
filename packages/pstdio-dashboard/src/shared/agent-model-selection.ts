export const getConfiguredAgentModel = (settings: Record<string, unknown> | undefined) => {
  const model = settings?.model;
  if (typeof model !== "string") return undefined;

  const trimmed = model.trim();
  return trimmed || undefined;
};

export const resolvePreferredAgentModel = (input: { configuredModel?: string; modelHistory: string[] }) => {
  const historyModel = input.modelHistory.find((model) => model.trim());
  return historyModel?.trim() ?? input.configuredModel;
};

export const resolveAvailableAgentModel = (input: {
  configuredModel?: string;
  modelHistory: string[];
  models: Array<{ id: string }>;
}) => {
  const availableModelIds = new Set(input.models.map((model) => model.id));
  const historyModel = input.modelHistory.find((model) => availableModelIds.has(model));
  if (historyModel) return historyModel;

  if (input.configuredModel && availableModelIds.has(input.configuredModel)) {
    return input.configuredModel;
  }

  return undefined;
};
