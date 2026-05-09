import type { AgentId, AgentRegistry } from "pstdio-agents";
import { isAgentEnabledForProject, parseProjectSelectedAgents } from "../../projects/selected-agents";

type ProjectRecord = {
  selected_agents?: string | null;
  default_agent_id?: string | null;
  default_agent_model?: string | null;
};

type AgentConfig = {
  agent_id: string;
  is_default: boolean;
};

export type ResolveAgentResult = { type: "error"; error: string } | { type: "ok"; agentId: string | undefined };

export const resolveCreateSessionAgent = (
  inputAgent: string | undefined,
  project: ProjectRecord | null,
  configuredAgents: AgentConfig[],
  agentRegistry: AgentRegistry,
): ResolveAgentResult => {
  if (inputAgent) {
    if (project && !isAgentEnabledForProject(project, inputAgent)) {
      return { type: "error", error: `Agent '${inputAgent}' is not enabled for this project.` };
    }
    return { type: "ok", agentId: inputAgent };
  }

  const selectedAgents = project ? parseProjectSelectedAgents(project) : [];
  const availableConfiguredAgents =
    selectedAgents.length === 0
      ? configuredAgents
      : configuredAgents.filter((config) => selectedAgents.includes(config.agent_id));

  const projectDefault = project?.default_agent_id ?? null;
  const projectDefaultIsRegistered = projectDefault ? Boolean(agentRegistry.get(projectDefault as AgentId)) : false;
  const projectDefaultIsAllowed = projectDefault
    ? selectedAgents.length === 0 || selectedAgents.includes(projectDefault)
    : false;

  if (projectDefault && projectDefaultIsRegistered && projectDefaultIsAllowed) {
    return { type: "ok", agentId: projectDefault };
  }

  const fallback = availableConfiguredAgents.find((config) => config.is_default) ?? availableConfiguredAgents[0];
  return { type: "ok", agentId: fallback?.agent_id };
};

export const resolveCreateSessionModel = (
  inputModel: string | undefined,
  project: ProjectRecord | null,
  agentId: string,
  agentRegistry: AgentRegistry,
  options: { requestAgentWasOmitted: boolean },
) => {
  const trimmedInputModel = inputModel?.trim();
  if (trimmedInputModel) return trimmedInputModel;
  if (!options.requestAgentWasOmitted) return undefined;

  const projectDefaultAgent = project?.default_agent_id ?? null;
  const projectDefaultModel = project?.default_agent_model ?? null;

  if (!projectDefaultModel || projectDefaultAgent !== agentId) return undefined;

  const agent = agentRegistry.get(agentId as AgentId);
  if (!agent) return undefined;

  const models = agent.listModels();
  if (models.some((m) => m.id === projectDefaultModel)) {
    return projectDefaultModel;
  }

  return models[0]?.id;
};
