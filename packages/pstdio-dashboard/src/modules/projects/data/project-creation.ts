import type { Project, WorkspaceListItem } from "@pstdio/sdk/resources";
import { apiRequest } from "@/lib/api";

export const deleteProject = (projectId: string) => apiRequest(`/v1/projects/${projectId}`, { method: "DELETE" });
export const createProject = async (input: { path: string }) => {
  const project = await apiRequest<Project>("/v1/projects", {
    method: "POST",
    body: { initial_workspace: { provider_id: "pstdio.root", params: { path: input.path } } },
  });
  const workspaces = await apiRequest<WorkspaceListItem[]>(`/v1/workspaces?project_id=${project.id}`);
  const home = workspaces.find((workspace) => workspace.is_default);
  if (home?.setup_error) throw new Error(home.setup_error);
  if (!home?.root_path || home.initializing || home.provider_state !== "ready")
    throw new Error("The project folder is not ready. Open it again to retry setup.");
  return project;
};
