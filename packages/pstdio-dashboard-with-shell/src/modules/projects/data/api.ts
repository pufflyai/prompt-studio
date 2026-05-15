import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import type { CreateProjectInput, Project } from "../types";
import { registerRepo } from "./repo-api";

interface ProjectResponse {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

const toProject = (response: ProjectResponse): Project => ({
  id: response.id,
  name: response.name,
  createdAt: response.created_at,
  updatedAt: response.updated_at,
});

export const createProject = async (input: CreateProjectInput) => {
  const response = await apiRequest<ProjectResponse>("/v1/projects", {
    method: "POST",
    body: { name: input.name, agents: input.agents },
  });

  try {
    await Promise.all(input.repositories.map((repo) => registerRepo(response.id, repo)));
  } catch (error) {
    await deleteProject(response.id).catch(() => undefined);
    throw error;
  }

  return toProject(response);
};

export const deleteProject = async (projectId: string) => {
  await apiRequest(`/v1/projects/${projectId}`, { method: "DELETE" });
};

export const useCreateProject = () => useMutation({ mutationFn: createProject });
