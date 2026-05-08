import type { Project as ProjectResponse } from "pstdio-api-contracts";
import { apiRequest } from "@/lib/api";

export type UpdateProjectDefaultsInput = {
  default_agent_id?: string | null;
  default_agent_model?: string | null;
};

export const getProjectDefaults = async (projectId: string) => apiRequest<ProjectResponse>(`/v1/projects/${projectId}`);

export const updateProjectDefaults = async (projectId: string, input: UpdateProjectDefaultsInput) =>
  apiRequest<ProjectResponse>(`/v1/projects/${projectId}`, {
    method: "PATCH",
    body: input,
  });
