type RemoveAgentOptions = {
  deleteSkills?: boolean;
};

export const removeAgent = async (baseUrl: string, agentId: string, options?: RemoveAgentOptions) => {
  const url = new URL(`${baseUrl}/v1/agents/${agentId}`);
  if (options?.deleteSkills) {
    url.searchParams.set("delete_skills", "true");
  }

  const res = await fetch(url.toString(), {
    method: "DELETE",
  });

  if (res.status === 404) {
    throw new Error(`Agent not found: ${agentId}`);
  }

  if (!res.ok) {
    throw new Error(`Failed to remove agent: ${res.status}`);
  }
};
