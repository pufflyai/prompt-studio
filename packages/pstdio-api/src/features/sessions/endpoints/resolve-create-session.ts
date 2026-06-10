import type { HarnessRegistryService } from "../../harnesses/harness-registry-service";
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

export const resolveCreateSessionAgent = async (
  inputAgent: string | undefined,
  project: ProjectRecord | null,
  configuredAgents: AgentConfig[],
  harnessRegistry: HarnessRegistryService,
): Promise<ResolveAgentResult> => {
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
  const projectDefaultIsRegistered = projectDefault ? Boolean(await harnessRegistry.get(projectDefault)) : false;
  const projectDefaultIsAllowed = projectDefault
    ? selectedAgents.length === 0 || selectedAgents.includes(projectDefault)
    : false;

  if (projectDefault && projectDefaultIsRegistered && projectDefaultIsAllowed) {
    return { type: "ok", agentId: projectDefault };
  }

  const fallback = availableConfiguredAgents.find((config) => config.is_default) ?? availableConfiguredAgents[0];
  return { type: "ok", agentId: fallback?.agent_id };
};

export const resolveCreateSessionModel = async (
  inputModel: string | undefined,
  project: ProjectRecord | null,
  agentId: string,
  harnessRegistry: HarnessRegistryService,
  options: { requestAgentWasOmitted: boolean },
) => {
  const trimmedInputModel = inputModel?.trim();
  if (trimmedInputModel) return trimmedInputModel;
  if (!options.requestAgentWasOmitted) return undefined;

  const projectDefaultAgent = project?.default_agent_id ?? null;
  const projectDefaultModel = project?.default_agent_model ?? null;

  if (!projectDefaultModel || projectDefaultAgent !== agentId) return undefined;

  const harness = await harnessRegistry.get(agentId);
  if (!harness) return undefined;

  const models = await harness.listModels();
  if (models.some((m) => m.id === projectDefaultModel)) {
    return projectDefaultModel;
  }

  return models[0]?.id;
};
