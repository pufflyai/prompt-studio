type Session = {
  id: string;
  project_id: string | null;
  title: string;
  status: string;
  archived: boolean;
  agent: string | null;
  created_at: string;
};

type ListOptions = {
  status?: string;
  agent?: string;
  workspaceId?: string;
  archived?: boolean;
};

export const listSessions = async (baseUrl: string, projectId: string, options?: ListOptions) => {
  const params = new URLSearchParams({ project_id: projectId });

  if (options?.status) params.set("status", options.status);
  if (options?.agent) params.set("agent", options.agent);
  if (options?.archived) params.set("archived", "true");

  const res = await fetch(`${baseUrl}/v1/sessions?${params}`);
  if (!res.ok) throw new Error(`Failed to list sessions: ${res.status}`);

  return (await res.json()) as Session[];
};
