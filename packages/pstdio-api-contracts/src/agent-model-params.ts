import type { AgentModel } from "./agents";

export const findAgentModel = (models: AgentModel[], modelId: string | null | undefined) =>
  modelId ? models.find((model) => model.id === modelId) : (models.find((model) => model.isDefault) ?? models[0]);

export const resolveAgentModelParams = <TDescriptor>(
  params: Record<string, TDescriptor> | null | undefined,
  model: Pick<AgentModel, "paramOverrides"> | null | undefined,
) => {
  if (!params) return null;

  const resolved = { ...params };
  for (const [key, descriptor] of Object.entries(model?.paramOverrides ?? {})) {
    if (descriptor) resolved[key] = descriptor as TDescriptor;
    else delete resolved[key];
  }
  return resolved;
};
