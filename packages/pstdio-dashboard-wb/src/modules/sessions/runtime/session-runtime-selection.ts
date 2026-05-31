interface RuntimeAgentOption {
  value: string;
  disabled?: boolean;
}

interface RuntimeRepositoryOption {
  id: string;
}

interface RuntimeModelOption {
  id: string;
}

interface RuntimeBranchOption {
  name: string;
  isCurrent: boolean;
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

export const resolveRuntimeRepositorySelection = (input: {
  repositories: RuntimeRepositoryOption[];
  selectedRepository: string;
}) => {
  if (input.repositories.some((repository) => repository.id === input.selectedRepository)) {
    return input.selectedRepository;
  }

  return input.repositories[0]?.id ?? "";
};

export const resolveRuntimeBranchSelection = (input: {
  branches: RuntimeBranchOption[];
  selectedBranch: string;
  lockedBranch: string | null | undefined;
}) => {
  if (input.lockedBranch) return input.lockedBranch;
  if (input.branches.some((branch) => branch.name === input.selectedBranch)) return input.selectedBranch;
  return input.branches.find((branch) => branch.isCurrent)?.name ?? input.branches[0]?.name ?? "";
};
