import type { Project as ProjectResponse } from "@pstdio/sdk/resources";
import { apiRequest } from "@/lib/api";
import type { ProjectRepository, RepoBranch } from "./project-types";

export type ApiRepo = {
  id: string;
  name: string;
  display_name: string | null;
  path: string;
  created_at: string;
  updated_at: string;
};

export const toProjectRepository = (repo: ApiRepo): ProjectRepository => ({
  id: repo.id,
  name: repo.name,
  displayName: repo.display_name,
  path: repo.path,
  createdAt: repo.created_at,
  updatedAt: repo.updated_at,
});

export const removeProjectRepository = async (projectId: string, repoId: string) => {
  await apiRequest(`/v1/projects/${projectId}/repos/${repoId}`, { method: "DELETE" });
};

export type UpdateProjectDefaultsInput = {
  default_agent_id?: string | null;
  default_agent_model?: string | null;
};

export const getProjectDefaults = (projectId: string) => apiRequest<ProjectResponse>(`/v1/projects/${projectId}`);

export const updateProjectDefaults = (projectId: string, input: UpdateProjectDefaultsInput) =>
  apiRequest<ProjectResponse>(`/v1/projects/${projectId}`, { method: "PATCH", body: input });

type ApiBranch = {
  name: string;
  is_current: boolean;
  is_remote: boolean;
  last_commit_date: string;
};

export const getRepoBranches = async (repoId: string): Promise<RepoBranch[]> => {
  const branches = await apiRequest<ApiBranch[]>(`/v1/repos/${repoId}/branches`);
  return branches.map((branch) => ({
    name: branch.name,
    isCurrent: branch.is_current,
    isRemote: branch.is_remote,
    lastCommitDate: branch.last_commit_date,
  }));
};
