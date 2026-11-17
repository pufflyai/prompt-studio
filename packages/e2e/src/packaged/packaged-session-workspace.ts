import { expect } from "@playwright/test";

// Related session placement belongs to regular workspaces; the project folder starts closed.
export const createPackagedSessionWorkspace = async (
  baseUrl: string,
  projectId: string,
  authorization: Record<string, string>,
) => {
  const response = await fetch(`${baseUrl}/v1/workspaces`, {
    method: "POST",
    headers: { ...authorization, "content-type": "application/json" },
    body: JSON.stringify({ project_id: projectId, provider_id: "pstdio.worktree", params: {} }),
  });
  expect(response.status).toBe(201);
  return (await response.json()) as { id: string; workspace_shorthand: string };
};
