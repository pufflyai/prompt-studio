import type { Project as ProjectResponse } from "@pstdio/sdk/resources";
import { standardResourceIcons } from "@pstdio/workbench";
import { apiRequest } from "@/lib/api";
import { createDashboardResource } from "@/shared/app/resources";

export interface CreateProjectRepositoryInput {
  path: string;
  displayName: string | null;
}

export interface CreateProjectInput {
  name: string;
  repositories: CreateProjectRepositoryInput[];
  agents: string[];
}

export interface CreatedDashboardProject {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  repoPath: string | null;
  resource: ReturnType<typeof createDashboardResource>;
}

interface ApiRepo {
  id: string;
  name: string;
  display_name: string | null;
  path: string;
  created_at: string;
  updated_at: string;
}

const resolveRepoName = (path: string, displayName?: string | null) => {
  const trimmedDisplayName = displayName?.trim();
  if (trimmedDisplayName) return trimmedDisplayName;

  const normalizedPath = path.replaceAll("\\", "/").replace(/\/+$/g, "");
  const segments = normalizedPath.split("/").filter(Boolean);

  return segments.at(-1) ?? "repo";
};

const toCreatedDashboardProject = (
  project: ProjectResponse,
  repositories: CreateProjectRepositoryInput[],
): CreatedDashboardProject => ({
  id: project.id,
  name: project.name,
  createdAt: project.created_at,
  updatedAt: project.updated_at,
  repoPath: repositories[0]?.path ?? null,
  resource: createDashboardResource("project", project.id, project.name, standardResourceIcons.project, project.id),
});

export const registerProjectRepository = async (
  projectId: string,
  input: { path: string; displayName?: string | null },
) => {
  await apiRequest<ApiRepo>(`/v1/projects/${projectId}/repos`, {
    method: "POST",
    body: {
      name: resolveRepoName(input.path, input.displayName),
      path: input.path,
    },
  });
};

export const deleteProject = async (projectId: string) => {
  await apiRequest(`/v1/projects/${projectId}`, { method: "DELETE" });
};

export const createProject = async (input: CreateProjectInput) => {
  const project = await apiRequest<ProjectResponse>("/v1/projects", {
    method: "POST",
    body: {
      name: input.name,
      agents: input.agents,
    },
  });

  try {
    await Promise.all(input.repositories.map((repo) => registerProjectRepository(project.id, repo)));
  } catch (error) {
    await deleteProject(project.id).catch(() => undefined);
    throw error;
  }

  return toCreatedDashboardProject(project, input.repositories);
};
