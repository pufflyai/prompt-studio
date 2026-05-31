import type { AgentInfo } from "@/shared/agents/agent-types";

export interface DraftRepository {
  path: string;
  name: string;
  displayName: string | null;
}

interface ProjectBasicsInput {
  name: string;
  repositories: DraftRepository[];
}

interface AgentAvailabilityStateInput {
  agentInfo: AgentInfo[];
  isAgentsLoading: boolean;
  isAgentsError: boolean;
}

export const hasProjectBasicsErrors = (input: ProjectBasicsInput) => {
  return input.name.trim().length === 0 || input.repositories.length === 0;
};

export const resolveInitialSelectedAgentIds = (availableAgents: { id: string }[]) => {
  return availableAgents.map((agent) => agent.id);
};

export const toggleAgentSelection = (selectedAgentIds: string[], agentId: string) => {
  return selectedAgentIds.includes(agentId)
    ? selectedAgentIds.filter((id) => id !== agentId)
    : [...selectedAgentIds, agentId];
};

export const canSubmitAgentSelection = (selectedAgentIds: string[]) => {
  return selectedAgentIds.length > 0;
};

export const resolveRepoName = (path: string) => {
  const normalizedPath = path.replaceAll("\\", "/").replace(/\/+$/g, "");
  const segments = normalizedPath.split("/").filter(Boolean);
  return segments.at(-1) ?? "repo";
};

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
