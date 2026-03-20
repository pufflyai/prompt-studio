import { apiRequest } from "@/lib/api";

export type ProjectSkill = {
  id: string;
  project_id: string;
  name: string;
  description: string;
  file_id: string;
  created_at: string;
  updated_at: string;
};

export type ProjectSkillWithContent = ProjectSkill & {
  content: string;
};

export const getProjectSkills = async (projectId: string) =>
  apiRequest<ProjectSkill[]>(`/v1/projects/${projectId}/skills`);

export const getProjectSkill = async (projectId: string, name: string) =>
  apiRequest<ProjectSkillWithContent>(`/v1/projects/${projectId}/skills/${encodeURIComponent(name)}`);
