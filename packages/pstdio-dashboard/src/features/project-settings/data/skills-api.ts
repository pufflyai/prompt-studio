import { apiRequest } from "@/lib/api";

export type ProjectSkill = {
  id: string;
  project_id: string;
  name: string;
  description: string;
  files: { path: string; content: string; encoding: "utf8" }[];
  source_kind?: string;
  read_only?: boolean;
  title?: string;
  origin_extension_id?: string;
  origin_skill_key?: string;
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

export const copyProjectSkill = async (projectId: string, name: string) =>
  apiRequest<ProjectSkill>(`/v1/projects/${projectId}/skills/${encodeURIComponent(name)}/copy`, {
    method: "POST",
    body: {},
  });

export const disableProjectSkillDefault = async (projectId: string, name: string) =>
  apiRequest<ProjectSkill>(`/v1/projects/${projectId}/skills/${encodeURIComponent(name)}/disable`, {
    method: "POST",
  });
