type ProjectRecord = {
  selected_agents?: string | null;
};

export const parseProjectSelectedAgents = (project: ProjectRecord) => {
  const raw = project.selected_agents;
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((agentId): agentId is string => typeof agentId === "string" && agentId.trim().length > 0);
  } catch {
    return [];
  }
};

export const isAgentEnabledForProject = (project: ProjectRecord, agentId: string) => {
  const selectedAgents = parseProjectSelectedAgents(project);
  if (selectedAgents.length === 0) {
    return true;
  }

  return selectedAgents.includes(agentId);
};
