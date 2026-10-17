import type { Skill, SkillWithContent } from "@pstdio/sdk/resources";
import { getApiClient } from "@/lib/api";
export type ProjectSkill = Skill;
export type ProjectSkillDetails = SkillWithContent;
export const getProjectSkills = (projectId: string) => getApiClient().skills.list(projectId);
export const getProjectSkill = (projectId: string, name: string) => getApiClient().skills.get(projectId, name);
