import { execFileSync } from "node:child_process";
import { expect } from "@playwright/test";

// Project Files has no automatic session preview. Exercise that policy on a separate workspace.
export const createPackagedPreviewWorkspace = async (
  origin: string,
  projectId: string,
  authorization: Record<string, string>,
) => {
  const response = await fetch(`${origin}/v1/workspaces?project_id=${projectId}`, { headers: authorization });
  expect(response.ok).toBe(true);
  const workspaces = (await response.json()) as Array<{ id: string; is_default: boolean; root_path: string }>;
  const home = workspaces.find((workspace) => workspace.is_default)!;
  expect(home.root_path).toBeTruthy();
  execFileSync("git", ["-C", home.root_path, "init", "-b", "main"]);
  execFileSync("git", [
    "-C",
    home.root_path,
    "-c",
    "user.name=E2E",
    "-c",
    "user.email=e2e@example.com",
    "commit",
    "--allow-empty",
    "-m",
    "Preview fixture",
  ]);
  const created = await fetch(`${origin}/v1/workspaces`, {
    method: "POST",
    headers: { ...authorization, "content-type": "application/json" },
    body: JSON.stringify({
      project_id: projectId,
      provider_id: "pstdio.worktree",
      params: {},
    }),
  });
  expect(created.status).toBe(201);
  const workspace = (await created.json()) as { id: string };
  const renamed = await fetch(`${origin}/v1/workspaces/${workspace.id}`, {
    method: "PATCH",
    headers: { ...authorization, "content-type": "application/json" },
    body: JSON.stringify({ name: "Preview workspace" }),
  });
  expect(renamed.status).toBe(200);
  return workspace;
};
