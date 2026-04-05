export type Skill = {
  id: string;
  project_id: string;
  name: string;
  description: string;
  file_id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type SkillWithContent = Skill & {
  content: string;
  bundled_version: string;
  installed_agents: string[];
};
