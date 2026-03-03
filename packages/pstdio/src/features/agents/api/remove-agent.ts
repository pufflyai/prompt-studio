export const removeAgent = async (baseUrl: string, agentId: string) => {
  const res = await fetch(`${baseUrl}/v1/agents/${agentId}`, {
    method: "DELETE",
  });

  if (res.status === 404) {
    throw new Error(`Agent not found: ${agentId}`);
  }

  if (!res.ok) {
    throw new Error(`Failed to remove agent: ${res.status}`);
  }
};
