import { apiRequest } from "@/lib/api";

interface DashboardWorkspaceResponse {
  id: string;
  workspace_shorthand: string;
  name: string;
}

interface CreateDashboardWorkspaceInput {
  projectId: string;
  repoId?: string;
  base?: string;
}

export const createDashboardWorkspace = (input: CreateDashboardWorkspaceInput) =>
  apiRequest<DashboardWorkspaceResponse>("/v1/workspaces", {
    method: "POST",
    body: {
      project_id: input.projectId,
      repo_id: input.repoId,
      base: input.base,
    },
  });

export const deleteDashboardWorkspace = (workspaceId: string) =>
  apiRequest(`/v1/workspaces/${workspaceId}`, { method: "DELETE" });

export const archiveDashboardWorkspace = (workspaceId: string) =>
  apiRequest<DashboardWorkspaceResponse>(`/v1/workspaces/${workspaceId}/archive`, { method: "POST" });

export const renameDashboardWorkspace = (workspaceId: string, name: string) =>
  apiRequest<DashboardWorkspaceResponse>(`/v1/workspaces/${workspaceId}`, { method: "PATCH", body: { name } });
