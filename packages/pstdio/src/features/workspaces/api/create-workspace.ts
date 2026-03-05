import type { Workspace } from "../types";

type CreateWorkspaceInput = {
  project_id: string;
  ticket_id: string;
  ticket_shorthand: string;
  branch?: string;
  worktree_path?: string;
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
