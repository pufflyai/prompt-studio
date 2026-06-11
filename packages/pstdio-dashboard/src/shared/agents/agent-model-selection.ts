const resolveAvailableAgentModel = (input: {
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

// Returns the model the selector should switch to, "" to clear it, or
// undefined to leave the current selection untouched.
export const resolveSynchronizedModel = (input: {
  currentAgent: string | null | undefined;
  currentModel: string;
  configuredModel?: string;
  modelsQuery: { isPending: boolean; data?: Array<{ id: string }> };
  modelHistory: string[];
}) => {
  if (!input.currentAgent) return input.currentModel ? "" : undefined;
  // isPending (not isLoading) so a disabled query — agents still loading, or
  // an unresolvable harness — is treated as "unknown", never as "no models".
  if (input.modelsQuery.isPending) return undefined;

  const models = input.modelsQuery.data ?? [];
  if (models.length === 0) return input.currentModel ? "" : undefined;

  const hasModelSelection = models.some((model) => model.id === input.currentModel);
  if (hasModelSelection) return undefined;

  return (
    resolveAvailableAgentModel({
      configuredModel: input.configuredModel,
      modelHistory: input.modelHistory,
      models,
    }) ?? models[0].id
  );
};
