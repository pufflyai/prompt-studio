import type { Project as ProjectResponse } from "@pstdio/sdk/resources";
import { apiRequest } from "@/lib/api";

export type UpdateProjectDefaultsInput = {
  name?: string;
  default_agent_id?: string | null;
  default_agent_model?: string | null;
};

export const getProjectDefaults = (projectId: string) => apiRequest<ProjectResponse>(`/v1/projects/${projectId}`);

export const updateProjectDefaults = (projectId: string, input: UpdateProjectDefaultsInput) =>
  apiRequest<ProjectResponse>(`/v1/projects/${projectId}`, { method: "PATCH", body: input });
