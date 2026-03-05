type WorkspaceListItem = {
  id: string;
  workspace_shorthand: string;
  ticket_shorthand: string;
  branch: string | null;
  worktree_path: string | null;
  status: string;
};

export const listWorkspaces = async (baseUrl: string, projectId: string) => {
  const res = await fetch(`${baseUrl}/v1/workspaces?project_id=${encodeURIComponent(projectId)}`);

  if (!res.ok) throw new Error(`Failed to list workspaces: ${res.status}`);

  return (await res.json()) as WorkspaceListItem[];
};
