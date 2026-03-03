type AgentConfig = {
  id: string;
  agent_id: string;
  is_default: boolean;
  config: string;
  created_at: string;
  updated_at: string;
};

export const setupAgent = async (baseUrl: string, agentId: string) => {
  const res = await fetch(`${baseUrl}/v1/agents`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ agent_id: agentId }),
  });

  if (!res.ok) {
    throw new Error(`Failed to setup agent: ${res.status}`);
  }

  return (await res.json()) as AgentConfig;
};
