type Workspace = {
  id: string;
  project_id: string;
  name: string;
  workspace_shorthand: string;
  branch: string | null;
  worktree_path: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export const getWorkspace = async (baseUrl: string, projectId: string, shorthand: string) => {
  const params = new URLSearchParams({ project_id: projectId, shorthand });
  const res = await fetch(`${baseUrl}/v1/workspaces/by-shorthand?${params}`);

  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to get workspace: ${res.status}`);

  return (await res.json()) as Workspace;
};
