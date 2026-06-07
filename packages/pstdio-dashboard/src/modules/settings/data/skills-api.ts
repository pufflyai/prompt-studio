import { apiRequest } from "@/lib/api";

export type ProjectSkill = {
  id: string;
  project_id: string;
  name: string;
  title: string;
  description: string;
  source_kind: "project" | "extension";
  files: { path: string; content: string; encoding: "utf8" }[];
  editable: boolean;
  extension_instance_id?: string;
  extension_id?: string;
  installed_extension_id?: string;
  install_name?: string;
  key?: string;
  enabled?: boolean;
  created_at: string;
  updated_at: string;
};

export type ProjectSkillDetails = ProjectSkill & {
  installed_agents: string[];
};

export const getProjectSkills = (projectId: string) => apiRequest<ProjectSkill[]>(`/v1/projects/${projectId}/skills`);

export const getProjectSkill = (projectId: string, name: string) =>
  apiRequest<ProjectSkillDetails>(`/v1/projects/${projectId}/skills/${encodeURIComponent(name)}`);
