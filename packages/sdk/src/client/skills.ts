import type { Page, PageQuery, SkillDetails, SkillWithContentDetails } from "pstdio-api-contracts";
import type { UpdateSkillInput } from "../api/skills";
import type { Skill, SkillWithContent } from "../resources";
import { pageQuery } from "./page-query";
import type { RequestFn } from "./request";

export type SkillClient = {
  query(projectId: string, input?: PageQuery): Promise<Page<Skill & SkillDetails>>;
  /** @deprecated Use query to read one bounded page. */
  list(projectId: string): Promise<Skill[]>;
  get(projectId: string, skillName: string): Promise<SkillWithContent & SkillWithContentDetails>;
  /** @deprecated No maintained client caller. Use `PUT /v1/projects/{projectId}/skills/{name}` for this operation; the convenience method is removed in 0.45. */
  updatePreferences(projectId: string, skillName: string, input: UpdateSkillInput): Promise<Skill>;
};

export const createSkillClient = (request: RequestFn): SkillClient => ({
  query: (projectId, input) => request(`/v1/projects/${encodeURIComponent(projectId)}/skills/query${pageQuery(input)}`),
  list: (projectId) => request(`/v1/projects/${encodeURIComponent(projectId)}/skills`),
  get: (projectId, skillName) =>
    request(`/v1/projects/${encodeURIComponent(projectId)}/skills/${encodeURIComponent(skillName)}`),
  updatePreferences: (projectId, skillName, input) =>
    request(`/v1/projects/${encodeURIComponent(projectId)}/skills/${encodeURIComponent(skillName)}`, {
      method: "PUT",
      body: input,
    }),
});
