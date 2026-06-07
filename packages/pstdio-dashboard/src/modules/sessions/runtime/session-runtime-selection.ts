interface RuntimeAgentOption {
  value: string;
  disabled?: boolean;
}

interface RuntimeWorkspaceOption {
  id: string;
}

interface RuntimeModelOption {
  id: string;
}

const hasEnabledAgent = (agentOptions: RuntimeAgentOption[], agentId: string | null | undefined) =>
  Boolean(agentId && agentOptions.some((option) => option.value === agentId && !option.disabled));

export const resolveRuntimeAgentSelection = (input: {
  agentOptions: RuntimeAgentOption[];
  selectedAgent: string;
  sessionAgent: string | null | undefined;
  defaultAgent: string | null | undefined;
}) => {
  if (input.sessionAgent) return input.sessionAgent;
  if (hasEnabledAgent(input.agentOptions, input.selectedAgent)) return input.selectedAgent;
  if (input.agentOptions.length === 0 && input.defaultAgent) return input.defaultAgent;
  if (hasEnabledAgent(input.agentOptions, input.defaultAgent)) return input.defaultAgent ?? "";
  return input.agentOptions.find((option) => !option.disabled)?.value ?? input.agentOptions[0]?.value ?? "";
};

export const resolveRuntimeModelSelection = (input: {
  models: RuntimeModelOption[];
  selectedModel: string;
  preferredModel: string | null | undefined;
}) => {
  if (input.models.some((model) => model.id === input.selectedModel)) return input.selectedModel;
  if (input.preferredModel && input.models.some((model) => model.id === input.preferredModel)) {
    return input.preferredModel;
  }
  if (input.preferredModel && input.models.length === 0) return input.preferredModel;
  return input.models[0]?.id ?? "";
};

export const resolveRuntimeWorkspaceSelection = (input: {
  workspaces: RuntimeWorkspaceOption[];
  selectedWorkspaceId: string;
  fallbackWorkspaceId: string | null | undefined;
}) => {
  if (input.workspaces.some((workspace) => workspace.id === input.selectedWorkspaceId)) {
    return input.selectedWorkspaceId;
  }

  if (
    input.fallbackWorkspaceId &&
    (input.workspaces.length === 0 || input.workspaces.some((workspace) => workspace.id === input.fallbackWorkspaceId))
  ) {
    return input.fallbackWorkspaceId;
  }

  return input.workspaces[0]?.id ?? "";
};
