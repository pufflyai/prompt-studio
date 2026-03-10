import { useEffect } from "react";
import { useWorkspaceStore } from "@/features/workspaces/state";
import type { CodingAgent } from "../agent-storage";
import { setStoredAgent } from "../agent-storage";
import { useAgentModels } from "../hooks/use-agent-models";
import { useAgents } from "../hooks/use-agents";
import { WorkspaceAgentMenu } from "./agent-browser";

interface WorkspaceAgentBrowserContainerProps {
  isDisabled?: boolean;
  isAgentSwitchDisabled?: boolean;
}

const DEFAULT_AGENT_ID = "opencode";

export const WorkspaceAgentBrowserContainer = (props: WorkspaceAgentBrowserContainerProps) => {
  const { isDisabled = false, isAgentSwitchDisabled = false } = props;

  const selectedAgent = useWorkspaceStore((state) => state.selectedAgent);
  const selectedModel = useWorkspaceStore((state) => state.selectedModel);
  const setSelectedAgent = useWorkspaceStore((state) => state.setSelectedAgent);
  const setSelectedModel = useWorkspaceStore((state) => state.setSelectedModel);

  const { data: agents = [] } = useAgents();
  const { data: models = [], isLoading: isModelsPending } = useAgentModels(selectedAgent, {
    enabled: Boolean(selectedAgent),
  });

  useEffect(() => {
    if (!selectedAgent) {
      if (selectedModel) {
        setSelectedModel("");
      }
      return;
    }

    if (isModelsPending) {
      return;
    }

    if (models.length === 0) {
      if (selectedModel) {
        setSelectedModel("");
      }
      return;
    }

    const hasModelSelection = models.some((model) => model.id === selectedModel);
    if (!hasModelSelection) {
      setSelectedModel(models[0].id);
    }
  }, [isModelsPending, models, selectedAgent, selectedModel, setSelectedModel]);

  const handleSelectAgent = (agent: string) => {
    const selected = agent as CodingAgent;
    setSelectedAgent(selected);
    setStoredAgent(selected);
  };

  const agentOptions = agents.map((agent) => ({
    label: agent.name,
    value: agent.id,
    disabled: agent.availability.type === "NOT_FOUND",
  }));

  return (
    <WorkspaceAgentMenu
      agentOptions={agentOptions}
      selectedAgent={selectedAgent || DEFAULT_AGENT_ID}
      onSelectAgent={handleSelectAgent}
      modelOptions={models.map((model) => ({ label: model.id, value: model.id }))}
      selectedModel={selectedModel}
      onSelectModel={setSelectedModel}
      isDisabled={isDisabled}
      isAgentSwitchDisabled={isAgentSwitchDisabled}
    />
  );
};
