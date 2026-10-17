import type { CreateWorkspaceCommandParams } from "@pstdio/sdk/extensions";
import { getApiClient } from "@/lib/api";

interface CreateDashboardWorkspaceInput extends CreateWorkspaceCommandParams {
  projectId: string;
  providerId: string;
  params?: Record<string, unknown>;
}

export const createDashboardWorkspace = (input: CreateDashboardWorkspaceInput) =>
  getApiClient().workspaces.create({
    project_id: input.projectId,
    provider_id: input.providerId,
    params: input.params,
    anchors: input.anchors,
    shorthand_base: input.shorthand_base,
  });

export const deleteDashboardWorkspace = (workspaceId: string) => getApiClient().workspaces.delete(workspaceId);

export const renameDashboardWorkspace = (workspaceId: string, name: string) =>
  getApiClient().workspaces.rename(workspaceId, { name });
