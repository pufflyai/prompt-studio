import { useEffect, useState } from "react";
import { useProjectSettingsStore } from "@/features/project-settings/store";
import type { CodingAgent } from "../agent-storage";
import { useAgentModels } from "../hooks/use-agent-models";
import { useAgents } from "../hooks/use-agents";
import { WorkspaceAgentMenu } from "./agent-browser";

interface AgentBrowserContainerProps {
  isDisabled?: boolean;
  isAgentSwitchDisabled?: boolean;
  onAgentChange?: (agent: CodingAgent) => void;
  onModelChange?: (model: string) => void;
}

const DEFAULT_AGENT_ID = "opencode";

export const AgentBrowserContainer = (props: AgentBrowserContainerProps) => {
  const { isDisabled = false, isAgentSwitchDisabled = false, onAgentChange, onModelChange } = props;

  const lastSelectedAgent = useProjectSettingsStore((s) => s.lastSelectedAgent);
  const lastSelectedModels = useProjectSettingsStore((s) => s.lastSelectedModels);
  const setLastSelectedAgent = useProjectSettingsStore((s) => s.setLastSelectedAgent);
  const setLastSelectedModel = useProjectSettingsStore((s) => s.setLastSelectedModel);

  const [selectedAgent, setSelectedAgent] = useState<CodingAgent>(lastSelectedAgent || DEFAULT_AGENT_ID);
  const [selectedModel, setSelectedModel] = useState(lastSelectedModels[0] ?? "");

  const { data: agents = [], isLoading: isAgentsPending } = useAgents();
  const { data: models = [], isLoading: isModelsPending } = useAgentModels(selectedAgent, {
    enabled: Boolean(selectedAgent),
  });

  useEffect(() => {
    if (!selectedAgent) {
      if (selectedModel) {
        setSelectedModel("");
        onModelChange?.("");
      }
      return;
    }

    if (isModelsPending) return;

    if (models.length === 0) {
      if (selectedModel) {
        setSelectedModel("");
        onModelChange?.("");
      }
      return;
    }

    const hasModelSelection = models.some((model) => model.id === selectedModel);
    if (!hasModelSelection) {
      // Prefer a previously selected model if available
      const preferred = lastSelectedModels.find((m) => models.some((model) => model.id === m));
      const next = preferred ?? models[0].id;
      setSelectedModel(next);
      onModelChange?.(next);
    }
  }, [isModelsPending, models, selectedAgent, selectedModel, lastSelectedModels, onModelChange]);

  const handleSelectAgent = (agent: string) => {
    const codingAgent = agent as CodingAgent;
    setSelectedAgent(codingAgent);
    setLastSelectedAgent(codingAgent);
    onAgentChange?.(codingAgent);
  };

  const handleSelectModel = (model: string) => {
    setSelectedModel(model);
    setLastSelectedModel(model);
    onModelChange?.(model);
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
      selectedAgent={selectedAgent || DEFAULT_AGENT_ID}
      onSelectAgent={handleSelectAgent}
      modelOptions={sortedModelOptions}
      selectedModel={selectedModel}
      onSelectModel={handleSelectModel}
      isDisabled={isDisabled}
      isAgentSwitchDisabled={isAgentSwitchDisabled}
      isAgentsLoading={isAgentsPending}
      isModelsLoading={isModelsPending}
    />
  );
};
