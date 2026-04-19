import { useEffect, useState } from "react";
import { useProjectSettingsStore } from "@/features/project-settings/store";
import { useSessionAgent } from "@/features/sessions/hooks/use-session-agent";
import type { CodingAgent } from "../agent-storage";
import { useAgentModels } from "../hooks/use-agent-models";
import { useAgents } from "../hooks/use-agents";
import { WorkspaceAgentMenu } from "./agent-browser";

interface AgentBrowserContainerProps {
  sessionId?: string | null;
  isDisabled?: boolean;
  onAgentChange?: (agent: CodingAgent) => void;
  onModelChange?: (model: string) => void;
}

const DEFAULT_AGENT_ID = "opencode";

export const AgentBrowserContainer = (props: AgentBrowserContainerProps) => {
  const { sessionId, isDisabled = false, onAgentChange, onModelChange } = props;

  const sessionAgent = useSessionAgent(sessionId ?? null);
  const isAgentLocked = sessionId != null && sessionAgent != null;

  const lastSelectedAgent = useProjectSettingsStore((s) => s.lastSelectedAgent);
  const lastSelectedModels = useProjectSettingsStore((s) => s.lastSelectedModels);
  const setLastSelectedAgent = useProjectSettingsStore((s) => s.setLastSelectedAgent);
  const setLastSelectedModel = useProjectSettingsStore((s) => s.setLastSelectedModel);

  const resolvedAgent = (isAgentLocked ? sessionAgent : (lastSelectedAgent ?? DEFAULT_AGENT_ID)) as CodingAgent;
  const [selectedAgent, setSelectedAgent] = useState<CodingAgent>(resolvedAgent);
  const [selectedModel, setSelectedModel] = useState(lastSelectedModels[0] ?? "");

  // Sync when the resolved agent changes (e.g. session loads, or session switches)
  useEffect(() => {
    if (resolvedAgent !== selectedAgent) {
      setSelectedAgent(resolvedAgent);
    }
  }, [resolvedAgent, selectedAgent]);

  useEffect(() => {
    if (selectedAgent) {
      onAgentChange?.(selectedAgent);
    }
  }, [selectedAgent, onAgentChange]);

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
      setLastSelectedModel(next);
      onModelChange?.(next);
    }
  }, [isModelsPending, models, selectedAgent, selectedModel, lastSelectedModels, setLastSelectedModel, onModelChange]);

  const handleSelectAgent = (agent: string) => {
    const codingAgent = agent as CodingAgent;
    setSelectedAgent(codingAgent);
    setLastSelectedAgent(codingAgent);
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
      isAgentSwitchDisabled={isAgentLocked}
      isAgentsLoading={isAgentsPending}
      isModelsLoading={isModelsPending}
    />
  );
};
