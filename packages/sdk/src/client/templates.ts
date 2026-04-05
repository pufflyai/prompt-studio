import type { CreateTemplateInput, UpdateTemplateInput } from "../api/templates";
import type { Template, TemplateWithContent } from "../resources";
import type { RequestFn } from "./request";

export type TemplateClient = {
  list(projectId: string): Promise<Template[]>;
  get(projectId: string, templateId: string): Promise<TemplateWithContent>;
  create(projectId: string, input: CreateTemplateInput): Promise<Template>;
  update(projectId: string, templateId: string, input: UpdateTemplateInput): Promise<Template>;
  delete(projectId: string, templateId: string): Promise<void>;
};

export const createTemplateClient = (request: RequestFn): TemplateClient => ({
  list: (projectId) => request(`/v1/projects/${projectId}/templates`),
  get: (projectId, templateId) => request(`/v1/projects/${projectId}/templates/${templateId}`),
  create: (projectId, input) => request(`/v1/projects/${projectId}/templates`, { method: "POST", body: input }),
  update: (projectId, templateId, input) =>
    request(`/v1/projects/${projectId}/templates/${templateId}`, { method: "PUT", body: input }),
  delete: (projectId, templateId) => request(`/v1/projects/${projectId}/templates/${templateId}`, { method: "DELETE" }),
});
