import { useEffect, useState } from "react";
import { useSessionAgent } from "@/features/sessions/hooks/use-session-agent";
import {
  getConfiguredAgentModel,
  resolveAvailableAgentModel,
  resolvePreferredAgentModel,
} from "@/shared/agent-model-selection";
import type { CodingAgent } from "@/shared/agent-storage";
import { useProjectSettingsStore } from "@/shared/stores/project-settings";
import { useAgentModels } from "../hooks/use-agent-models";
import { useAgentSettings } from "../hooks/use-agent-settings";
import { useAgents } from "../hooks/use-agents";
import { WorkspaceAgentMenu } from "./agent-browser";

interface AgentBrowserContainerProps {
  sessionId?: string | null;
  isDisabled?: boolean;
  selectedAgent?: CodingAgent;
  selectedModel?: string;
  onAgentChange?: (agent: CodingAgent) => void;
  onModelChange?: (model: string) => void;
}

const DEFAULT_AGENT_ID = "opencode";

const resolveSynchronizedModel = (input: {
  currentAgent: string | null | undefined;
  currentModel: string;
  configuredModel: string | undefined;
  isModelsPending: boolean;
  lastSelectedModels: string[];
  models: { id: string }[];
}) => {
  if (!input.currentAgent) return input.currentModel ? "" : undefined;
  if (input.isModelsPending) return undefined;
  if (input.models.length === 0) return input.currentModel ? "" : undefined;

  const hasModelSelection = input.models.some((model) => model.id === input.currentModel);
  if (hasModelSelection) return undefined;

  return (
    resolveAvailableAgentModel({
      configuredModel: input.configuredModel,
      modelHistory: input.lastSelectedModels,
      models: input.models,
    }) ?? input.models[0].id
  );
};

export const AgentBrowserContainer = (props: AgentBrowserContainerProps) => {
  const { sessionId, isDisabled = false, selectedAgent, selectedModel, onAgentChange, onModelChange } = props;

  const sessionAgent = useSessionAgent(sessionId ?? null);
  const isAgentLocked = sessionId != null && sessionAgent != null;

  const lastSelectedAgent = useProjectSettingsStore((s) => s.lastSelectedAgent);
  const lastSelectedModels = useProjectSettingsStore((s) => s.lastSelectedModels);
  const setLastSelectedAgent = useProjectSettingsStore((s) => s.setLastSelectedAgent);
  const setLastSelectedModel = useProjectSettingsStore((s) => s.setLastSelectedModel);

  const resolvedAgent = (isAgentLocked ? sessionAgent : (lastSelectedAgent ?? DEFAULT_AGENT_ID)) as CodingAgent;
  const [internalSelectedAgent, setInternalSelectedAgent] = useState<CodingAgent>(resolvedAgent);
  const [internalSelectedModel, setInternalSelectedModel] = useState(lastSelectedModels[0] ?? "");
  const currentAgent = selectedAgent ?? internalSelectedAgent;
  const currentModel = selectedModel ?? internalSelectedModel;
  const { data: agentSettings = {} } = useAgentSettings(currentAgent);
  const configuredModel = getConfiguredAgentModel(agentSettings);
  const preferredModel = resolvePreferredAgentModel({ configuredModel, modelHistory: lastSelectedModels });
  const applyModelSelection = (model: string) => {
    if (selectedModel === undefined) {
      setInternalSelectedModel(model);
    }
    onModelChange?.(model);
  };

  // Sync when the resolved agent changes (e.g. session loads, or session switches)
  useEffect(() => {
    if (selectedAgent === undefined && resolvedAgent !== internalSelectedAgent) {
      setInternalSelectedAgent(resolvedAgent);
    }
  }, [resolvedAgent, internalSelectedAgent, selectedAgent]);

  useEffect(() => {
    if (currentAgent) {
      onAgentChange?.(currentAgent);
    }
  }, [currentAgent, onAgentChange]);

  useEffect(() => {
    if (!preferredModel || currentModel) return;

    if (selectedModel === undefined) {
      setInternalSelectedModel(preferredModel);
    }
    onModelChange?.(preferredModel);
  }, [preferredModel, currentModel, selectedModel, onModelChange]);

  const { data: agents = [], isLoading: isAgentsPending } = useAgents();
  const { data: models = [], isLoading: isModelsPending } = useAgentModels(currentAgent, {
    enabled: Boolean(currentAgent),
  });

  useEffect(() => {
    const next = resolveSynchronizedModel({
      currentAgent,
      currentModel,
      configuredModel,
      isModelsPending,
      lastSelectedModels,
      models,
    });
    if (next === undefined) return;

    if (selectedModel === undefined) {
      setInternalSelectedModel(next);
    }
    onModelChange?.(next);
    if (next && next !== configuredModel) {
      setLastSelectedModel(next);
    }
  }, [
    configuredModel,
    currentAgent,
    currentModel,
    isModelsPending,
    lastSelectedModels,
    models,
    onModelChange,
    selectedModel,
    setLastSelectedModel,
  ]);

  const handleSelectAgent = (agent: string) => {
    const codingAgent = agent as CodingAgent;
    if (selectedAgent === undefined) {
      setInternalSelectedAgent(codingAgent);
    }
    setLastSelectedAgent(codingAgent);
    applyModelSelection("");
    onAgentChange?.(codingAgent);
  };

  const handleSelectModel = (model: string) => {
    applyModelSelection(model);
    setLastSelectedModel(model);
  };

  const sortedModelOptions = models
    .map((model) => ({ label: model.id, value: model.id }))
    .sort((a, b) => {
      const aIndex = lastSelectedModels.indexOf(a.value);
      const bIndex = lastSelectedModels.indexOf(b.value);
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return 0;
    });

  return (
    <WorkspaceAgentMenu
      agentOptions={agents.map((agent) => ({
        label: agent.name,
        value: agent.id,
        disabled: agent.availability.type === "NOT_FOUND",
      }))}
      selectedAgent={currentAgent || DEFAULT_AGENT_ID}
      onSelectAgent={handleSelectAgent}
      modelOptions={sortedModelOptions}
      selectedModel={currentModel}
      onSelectModel={handleSelectModel}
      isDisabled={isDisabled}
      isAgentSwitchDisabled={isAgentLocked}
      isAgentsLoading={isAgentsPending}
      isModelsLoading={isModelsPending}
    />
  );
};
