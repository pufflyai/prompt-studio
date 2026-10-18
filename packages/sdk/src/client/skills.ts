import type { UpdateSkillInput } from "../api/skills";
import type { Skill, SkillWithContent } from "../resources";
import type { RequestFn } from "./request";

export type SkillClient = {
  list(projectId: string): Promise<Skill[]>;
  get(projectId: string, skillId: string): Promise<SkillWithContent>;
  /** @deprecated No maintained client caller. Use `PUT /v1/projects/{projectId}/skills/{name}` for this operation; the convenience method is removed in 0.45. */
  updatePreferences(projectId: string, skillName: string, input: UpdateSkillInput): Promise<Skill>;
};

export const createSkillClient = (request: RequestFn): SkillClient => ({
  list: (projectId) => request(`/v1/projects/${encodeURIComponent(projectId)}/skills`),
  get: (projectId, skillId) =>
    request(`/v1/projects/${encodeURIComponent(projectId)}/skills/${encodeURIComponent(skillId)}`),
  updatePreferences: (projectId, skillName, input) =>
    request(`/v1/projects/${encodeURIComponent(projectId)}/skills/${encodeURIComponent(skillName)}`, {
      method: "PUT",
      body: input,
    }),
});
