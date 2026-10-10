import { type HarnessParamValues, harnessParamValuesEqual } from "../components/harness-param-values";

interface RuntimeAgentOption {
  value: string;
  disabled?: boolean;
}

interface RuntimeWorkspaceOption {
  id: string;
}

interface RuntimeModelOption {
  id: string;
  isDefault?: boolean;
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

// A run needs a harness that is enabled for the project, and a model when the harness offers models.
export const canSubmitSessionMessage = (input: {
  agentOptions: RuntimeAgentOption[];
  selectedAgent: string;
  selectedModel: string;
  requiresModel: boolean;
}) =>
  hasEnabledAgent(input.agentOptions, input.selectedAgent) && (!input.requiresModel || Boolean(input.selectedModel));

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
  return input.models.find((model) => model.isDefault)?.id ?? input.models[0]?.id ?? "";
};

interface SessionViewSelectionSnapshot {
  agent: string | null;
  lastSelectedModel: string | null;
  workspaceId: string | null;
  params?: HarnessParamValues;
}

// Reconciles the user's unsent selector picks with a refreshed view of the same session. Only
// fields the backend changed are adopted, so a sync refresh never clobbers an unsent pick.
export const resolveSessionSelectionSync = (
  previous: SessionViewSelectionSnapshot,
  view: SessionViewSelectionSnapshot,
) => {
  const updates: { agent?: string; model?: string; workspaceId?: string; params?: HarnessParamValues } = {};
  if (view.params && !harnessParamValuesEqual(previous.params ?? {}, view.params)) updates.params = view.params;
  if (view.agent && view.agent !== previous.agent) updates.agent = view.agent;
  if (view.lastSelectedModel && view.lastSelectedModel !== previous.lastSelectedModel) {
    updates.model = view.lastSelectedModel;
  }
  if (view.workspaceId && view.workspaceId !== previous.workspaceId) updates.workspaceId = view.workspaceId;
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
