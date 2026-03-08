type SkillResponse = {
  id: string;
  project_id: string;
  name: string;
  description: string;
  file_id: string;
  created_at: string;
  updated_at: string;
};

type SkillWithContent = SkillResponse & { content: string };

export const listSkills = async (baseUrl: string, projectId: string) => {
  const res = await fetch(`${baseUrl}/v1/projects/${projectId}/skills`);
  if (!res.ok) throw new Error(`Failed to list skills: ${res.status}`);
  return (await res.json()) as SkillResponse[];
};

export const getSkill = async (baseUrl: string, projectId: string, name: string) => {
  const res = await fetch(`${baseUrl}/v1/projects/${projectId}/skills/${name}`);
  if (!res.ok) throw new Error(`Failed to get skill "${name}": ${res.status}`);
  return (await res.json()) as SkillWithContent;
};

export const listSkillsWithContent = async (baseUrl: string, projectId: string) => {
  const skills = await listSkills(baseUrl, projectId);
  const results: SkillWithContent[] = [];

  for (const skill of skills) {
    const full = await getSkill(baseUrl, projectId, skill.name);
    results.push(full);
  }

  return results;
};
