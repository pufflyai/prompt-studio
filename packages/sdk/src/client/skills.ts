import type { Skill, SkillWithContent } from "../resources";
import type { RequestFn } from "./request";

export type SkillClient = {
  list(projectId: string): Promise<Skill[]>;
  get(projectId: string, skillId: string): Promise<SkillWithContent>;
};

export const createSkillClient = (request: RequestFn): SkillClient => ({
  list: (projectId) => request(`/v1/projects/${projectId}/skills`),
  get: (projectId, skillId) => request(`/v1/projects/${projectId}/skills/${skillId}`),
});
