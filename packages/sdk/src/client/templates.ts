import type { CopyTemplateInput, CreateTemplateInput, UpdateTemplateInput } from "../api/templates";
import type { Template, TemplateWithContent } from "../resources";
import type { RequestFn } from "./request";

export type TemplateClient = {
  list(projectId: string, filters?: { type?: string }): Promise<Template[]>;
  get(projectId: string, templateId: string): Promise<TemplateWithContent>;
  create(projectId: string, input: CreateTemplateInput): Promise<Template>;
  update(projectId: string, templateId: string, input: UpdateTemplateInput): Promise<Template>;
  delete(projectId: string, templateId: string): Promise<void>;
  copy(projectId: string, templateId: string, input?: CopyTemplateInput): Promise<Template>;
  disable(projectId: string, templateId: string): Promise<Template>;
  enable(projectId: string, templateId: string): Promise<Template>;
};

const templatePath = (projectId: string, templateId: string) =>
  `/v1/projects/${projectId}/templates/${encodeURIComponent(templateId)}`;

export const createTemplateClient = (request: RequestFn): TemplateClient => ({
  list: (projectId, filters) => {
    const search = filters?.type ? `?type=${encodeURIComponent(filters.type)}` : "";
    return request(`/v1/projects/${projectId}/templates${search}`);
  },
  get: (projectId, templateId) => request(templatePath(projectId, templateId)),
  create: (projectId, input) => request(`/v1/projects/${projectId}/templates`, { method: "POST", body: input }),
  update: (projectId, templateId, input) =>
    request(templatePath(projectId, templateId), { method: "PUT", body: input }),
  delete: (projectId, templateId) => request(templatePath(projectId, templateId), { method: "DELETE" }),
  copy: (projectId, templateId, input = {}) =>
    request(`${templatePath(projectId, templateId)}/copy`, { method: "POST", body: input }),
  disable: (projectId, templateId) => request(`${templatePath(projectId, templateId)}/disable`, { method: "POST" }),
  enable: (projectId, templateId) => request(`${templatePath(projectId, templateId)}/enable`, { method: "POST" }),
});
