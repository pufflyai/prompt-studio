import type { AgentInfo } from "@/features/agents/types";

interface AgentAvailabilityStateInput {
  agentInfo: AgentInfo[];
  isAgentsLoading: boolean;
  isAgentsError: boolean;
}

export const resolveProjectCreationAvailability = (input: AgentAvailabilityStateInput) => {
  const availableAgents = input.agentInfo.filter((agent) => agent.availability.type === "INSTALLED");
  const hasAvailableAgents = availableAgents.length > 0;
  const showNoAgentsBanner = !input.isAgentsLoading && !input.isAgentsError && !hasAvailableAgents;
  const showAgentErrorBanner = input.isAgentsError;
  const isCreateProjectBlocked = input.isAgentsLoading || showAgentErrorBanner || showNoAgentsBanner;

  return {
    availableAgents,
    showNoAgentsBanner,
    showAgentErrorBanner,
    isCreateProjectBlocked,
  };
};
