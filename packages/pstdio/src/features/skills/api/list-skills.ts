import { apiClient } from "@/features/api-client";

export const listSkills = async (projectId: string) => apiClient().skills.list(projectId);

export const getSkill = async (projectId: string, name: string) => apiClient().skills.get(projectId, name);

export const listSkillsWithFiles = async (projectId: string) => {
  const skills = await listSkills(projectId);
  const results = [];

  for (const skill of skills) {
    const full = await getSkill(projectId, skill.name);
    results.push(full);
  }

  return results;
};
