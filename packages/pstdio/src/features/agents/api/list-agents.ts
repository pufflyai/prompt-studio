type AgentConfig = {
  id: string;
  agent_id: string;
  is_default: boolean;
  config: string;
  created_at: string;
  updated_at: string;
};

export const listAgents = async (baseUrl: string) => {
  const res = await fetch(`${baseUrl}/v1/agents`);

  if (!res.ok) {
    throw new Error(`Failed to list agents: ${res.status}`);
  }

  return (await res.json()) as AgentConfig[];
};
