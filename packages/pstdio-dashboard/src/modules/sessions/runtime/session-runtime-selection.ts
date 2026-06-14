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
  // While the agent's model list is unknown, a transient empty list must not
  // replace an explicit selection with the preferred/default model.
  if (input.selectedModel && input.models.length === 0) return input.selectedModel;
  if (input.preferredModel && input.models.some((model) => model.id === input.preferredModel)) {
    return input.preferredModel;
  }
  if (input.preferredModel && input.models.length === 0) return input.preferredModel;
  return input.models[0]?.id ?? "";
};

interface SessionViewSelectionSnapshot {
  agent: string | null;
  lastSelectedModel: string | null;
  workspaceId: string | null;
}

/**
 * Reconciles the user's in-flight selector picks with a refreshed session view.
 * Same view (or a draft that just became its session): adopt only fields the
 * backend changed, so sync refreshes never clobber an unsent pick. A switch to
 * a different session resets everything to that session's values.
 */
export const resolveSessionSelectionSync = (input: {
  isViewSwitch: boolean;
  isPreviousViewDraft: boolean;
  previous: SessionViewSelectionSnapshot;
  view: SessionViewSelectionSnapshot;
}) => {
  if (input.isViewSwitch && !input.isPreviousViewDraft) {
    return {
      agent: input.view.agent ?? "",
      model: input.view.lastSelectedModel ?? "",
      workspaceId: input.view.workspaceId ?? "",
    };
  }

  const updates: { agent?: string; model?: string; workspaceId?: string } = {};
  if (input.view.agent && input.view.agent !== input.previous.agent) updates.agent = input.view.agent;
  if (input.view.lastSelectedModel && input.view.lastSelectedModel !== input.previous.lastSelectedModel) {
    updates.model = input.view.lastSelectedModel;
  }
  if (input.view.workspaceId && input.view.workspaceId !== input.previous.workspaceId) {
    updates.workspaceId = input.view.workspaceId;
  }
  return updates;
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
