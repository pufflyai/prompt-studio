import type { UpdateSkillInput } from "../api/skills";
import type { Skill, SkillWithContent } from "../resources";
import type { RequestFn } from "./request";

export type SkillClient = {
  list(projectId: string): Promise<Skill[]>;
  get(projectId: string, skillId: string): Promise<SkillWithContent>;
  updatePreferences(projectId: string, skillName: string, input: UpdateSkillInput): Promise<Skill>;
  update(projectId: string, skillName: string): Promise<SkillWithContent>;
};

export const createSkillClient = (request: RequestFn): SkillClient => ({
  list: (projectId) => request(`/v1/projects/${projectId}/skills`),
  get: (projectId, skillId) => request(`/v1/projects/${projectId}/skills/${skillId}`),
  updatePreferences: (projectId, skillName, input) =>
    request(`/v1/projects/${projectId}/skills/${skillName}`, { method: "PUT", body: input }),
  update: (projectId, skillName) => request(`/v1/projects/${projectId}/skills/${skillName}/update`, { method: "POST" }),
});
