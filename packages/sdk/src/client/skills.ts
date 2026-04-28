import type { CopySkillInput, UpdateSkillInput } from "../api/skills";
import type { Skill, SkillWithContent } from "../resources";
import type { RequestFn } from "./request";

export type SkillClient = {
  list(projectId: string): Promise<Skill[]>;
  get(projectId: string, skillId: string): Promise<SkillWithContent>;
  update(projectId: string, skillName: string): Promise<SkillWithContent>;
  edit(projectId: string, skillName: string, input: UpdateSkillInput): Promise<Skill>;
  copy(projectId: string, skillName: string, input?: CopySkillInput): Promise<Skill>;
  disable(projectId: string, skillName: string): Promise<Skill>;
  enable(projectId: string, skillName: string): Promise<Skill>;
};

const skillPath = (projectId: string, skillName: string) =>
  `/v1/projects/${projectId}/skills/${encodeURIComponent(skillName)}`;

export const createSkillClient = (request: RequestFn): SkillClient => ({
  list: (projectId) => request(`/v1/projects/${projectId}/skills`),
  get: (projectId, skillId) => request(skillPath(projectId, skillId)),
  update: (projectId, skillName) => request(`${skillPath(projectId, skillName)}/update`, { method: "POST" }),
  edit: (projectId, skillName, input) => request(skillPath(projectId, skillName), { method: "PUT", body: input }),
  copy: (projectId, skillName, input = {}) =>
    request(`${skillPath(projectId, skillName)}/copy`, { method: "POST", body: input }),
  disable: (projectId, skillName) => request(`${skillPath(projectId, skillName)}/disable`, { method: "POST" }),
  enable: (projectId, skillName) => request(`${skillPath(projectId, skillName)}/enable`, { method: "POST" }),
});
