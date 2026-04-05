import type { ProjectResponse } from "pstdio-api/dto";
import { apiRequest } from "@/lib/api";
import type { ProjectListItem } from "../types";
import { registerRepo } from "./repo-api";
import type { CreateProjectInput } from "./types";

export const toProjectListItem = (project: ProjectResponse): ProjectListItem => ({
  id: project.id,
  name: project.name,
  createdAt: project.created_at,
  updatedAt: project.updated_at,
  repoPath: null,
});

export const getProjects = async () => {
  const projects = await apiRequest<ProjectResponse[]>("/v1/projects");
  return projects.map(toProjectListItem);
};

export const createProject = async (input: CreateProjectInput) => {
  const project = await apiRequest<ProjectResponse>("/v1/projects", {
    method: "POST",
    body: {
      name: input.name,
    },
  });

  try {
    await Promise.all(input.repositories.map((repo) => registerRepo(project.id, repo)));
  } catch (error) {
    await deleteProject(project.id).catch(() => undefined);
    throw error;
  }

  return {
    ...toProjectListItem(project),
    repoPath: input.repositories[0]?.path ?? null,
  };
};

export const deleteProject = async (projectId: string) => {
  await apiRequest(`/v1/projects/${projectId}`, {
    method: "DELETE",
  });
};

export type { CreateProjectInput, ProjectResponse };
