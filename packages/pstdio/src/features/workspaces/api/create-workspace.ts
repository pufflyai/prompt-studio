type CreateWorkspaceInput = {
  project_id: string;
  ticket_id: string;
  ticket_shorthand: string;
  branch?: string;
  worktree_path?: string;
};

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

export const createWorkspace = async (baseUrl: string, input: CreateWorkspaceInput) => {
  const res = await fetch(`${baseUrl}/v1/workspaces`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) throw new Error(`Failed to create workspace: ${res.status}`);

  return (await res.json()) as Workspace;
};
