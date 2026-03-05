type Status = { id: string; name: string; color: string; sort_order: number; is_default: boolean };

type CreateInput = {
  name: string;
  color: string;
  is_default?: boolean;
};

export const createStatus = async (baseUrl: string, projectId: string, input: CreateInput) => {
  const res = await fetch(`${baseUrl}/v1/projects/${encodeURIComponent(projectId)}/statuses`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    throw new Error(`Failed to create status: ${res.status}`);
  }

  return (await res.json()) as Status;
};
