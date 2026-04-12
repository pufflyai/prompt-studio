import { apiRequest } from "@/lib/api";

export type ProjectSkill = {
  id: string;
  project_id: string;
  name: string;
  description: string;
  files: { path: string; content: string; encoding: "utf8" }[];
  created_at: string;
  updated_at: string;
};

export type ProjectSkillDetails = ProjectSkill & {
  bundled_version: string;
  installed_agents: string[];
};

export const getProjectSkills = async (projectId: string) =>
  apiRequest<ProjectSkill[]>(`/v1/projects/${projectId}/skills`);

export const getProjectSkill = async (projectId: string, name: string) =>
  apiRequest<ProjectSkillDetails>(`/v1/projects/${projectId}/skills/${encodeURIComponent(name)}`);

export const updateProjectSkill = async (projectId: string, name: string) =>
  apiRequest<ProjectSkillDetails>(`/v1/projects/${projectId}/skills/${encodeURIComponent(name)}/update`, {
    method: "POST",
  });
