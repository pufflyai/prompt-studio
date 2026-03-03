type AgentConfig = {
  id: string;
  agent_id: string;
  is_default: boolean;
  config: string;
  created_at: string;
  updated_at: string;
};

type UpdateFields = {
  is_default?: boolean;
  binary?: string;
  skills_dir?: string;
};

export const updateAgent = async (baseUrl: string, agentId: string, fields: UpdateFields) => {
  const res = await fetch(`${baseUrl}/v1/agents/${agentId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(fields),
  });

  if (res.status === 404) {
    throw new Error(`Agent not found: ${agentId}`);
  }

  if (!res.ok) {
    throw new Error(`Failed to update agent: ${res.status}`);
  }

  return (await res.json()) as AgentConfig;
};
