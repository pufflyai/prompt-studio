import { useEffect } from "react";
import { useAgentStore } from "@/features/agents/state";
import type { CodingAgent } from "../agent-storage";
import { useAgentModels } from "../hooks/use-agent-models";
import { useAgents } from "../hooks/use-agents";
import { WorkspaceAgentMenu } from "./agent-browser";

interface AgentBrowserContainerProps {
  isDisabled?: boolean;
  isAgentSwitchDisabled?: boolean;
}

const DEFAULT_AGENT_ID = "opencode";

export const AgentBrowserContainer = (props: AgentBrowserContainerProps) => {
  const { isDisabled = false, isAgentSwitchDisabled = false } = props;

  const selectedAgent = useAgentStore((state) => state.selectedAgent);
  const selectedModel = useAgentStore((state) => state.selectedModel);
  const setSelectedAgent = useAgentStore((state) => state.setSelectedAgent);
  const setSelectedModel = useAgentStore((state) => state.setSelectedModel);

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
    setSelectedAgent(agent as CodingAgent);
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
