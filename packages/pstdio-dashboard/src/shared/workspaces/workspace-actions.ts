import type { CreateWorkspaceCommandParams } from "@pstdio/sdk/extensions";
import { apiRequest } from "@/lib/api";

interface DashboardWorkspaceResponse {
  id: string;
  workspace_shorthand: string;
  name: string;
}

interface CreateDashboardWorkspaceInput extends CreateWorkspaceCommandParams {
  projectId: string;
  providerId: string;
  params?: Record<string, unknown>;
}

export const createDashboardWorkspace = (input: CreateDashboardWorkspaceInput) =>
  apiRequest<DashboardWorkspaceResponse>("/v1/workspaces", {
    method: "POST",
    body: {
      project_id: input.projectId,
      provider_id: input.providerId,
      params: input.params,
      anchors: input.anchors,
    },
  });

export const deleteDashboardWorkspace = (workspaceId: string) =>
  apiRequest(`/v1/workspaces/${workspaceId}`, { method: "DELETE" });

export const archiveDashboardWorkspace = (workspaceId: string) =>
  apiRequest<DashboardWorkspaceResponse>(`/v1/workspaces/${workspaceId}/archive`, { method: "POST" });

export const renameDashboardWorkspace = (workspaceId: string, name: string) =>
  apiRequest<DashboardWorkspaceResponse>(`/v1/workspaces/${workspaceId}`, { method: "PATCH", body: { name } });
