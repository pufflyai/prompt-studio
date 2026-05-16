interface HarnessAgentInfo {
  id: string;
  name: string;
  availability: {
    type: string;
  };
}

interface HarnessAgentConfig {
  agent_id: string;
  is_default: boolean;
  config: string;
}

export interface HarnessRow {
  id: string;
  name: string;
  isInstalled: boolean;
  config?: HarnessAgentConfig;
}

export const readBinaryPath = (rawConfig: string) => {
  try {
    const parsed = JSON.parse(rawConfig) as { binary?: unknown };
    return typeof parsed.binary === "string" && parsed.binary.length > 0 ? parsed.binary : undefined;
  } catch {
    return undefined;
  }
};

export const toHarnessRows = (agents: HarnessAgentInfo[], configs: HarnessAgentConfig[]): HarnessRow[] => {
  const configByAgentId = new Map(configs.map((config) => [config.agent_id, config]));
  const knownRows = agents.map((agent) => ({
    id: agent.id,
    name: agent.name,
    isInstalled: agent.availability.type === "INSTALLED",
    config: configByAgentId.get(agent.id),
  }));

  const knownAgentIds = new Set(agents.map((agent) => agent.id));
  const configuredOnlyRows = configs
    .filter((config) => !knownAgentIds.has(config.agent_id))
    .map((config) => ({
      id: config.agent_id,
      name: config.agent_id,
      isInstalled: false,
      config,
    }));

  return [...knownRows, ...configuredOnlyRows];
};

export const resolveDefaultHarnessId = (projectDefaultAgentId: string | null, rows: HarnessRow[]) => {
  if (projectDefaultAgentId) return projectDefaultAgentId;
  return rows.find((row) => row.config?.is_default)?.id ?? rows.find((row) => row.config)?.id ?? "";
};
