import type { CreateTagInput, CreateTagOptionInput, UpdateTagInput, UpdateTagOptionInput } from "../api/tags";
import type { Tag, TagOption } from "../resources";
import type { RequestFn } from "./request";

/** @deprecated Legacy core ticket tag client. Ticket tags are owned by the pstdio tickets extension. */
export type TagClient = {
  list(projectId: string): Promise<Tag[]>;
  create(projectId: string, input: CreateTagInput): Promise<Tag>;
  update(projectId: string, tagId: string, input: UpdateTagInput): Promise<Tag>;
  delete(projectId: string, tagId: string): Promise<void>;
  createOption(projectId: string, tagId: string, input: CreateTagOptionInput): Promise<TagOption>;
  updateOption(projectId: string, tagId: string, optionId: string, input: UpdateTagOptionInput): Promise<TagOption>;
  deleteOption(projectId: string, tagId: string, optionId: string): Promise<void>;
};

/** @deprecated Legacy core ticket tag client. Ticket tags are owned by the pstdio tickets extension. */
export const createTagClient = (request: RequestFn): TagClient => ({
  list: (projectId) => request(`/v1/projects/${projectId}/ticket-tags`),
  create: (projectId, input) => request(`/v1/projects/${projectId}/ticket-tags`, { method: "POST", body: input }),
  update: (projectId, tagId, input) =>
    request(`/v1/projects/${projectId}/ticket-tags/${tagId}`, { method: "PATCH", body: input }),
  delete: (projectId, tagId) => request(`/v1/projects/${projectId}/ticket-tags/${tagId}`, { method: "DELETE" }),
  createOption: (projectId, tagId, input) =>
    request(`/v1/projects/${projectId}/ticket-tags/${tagId}/options`, { method: "POST", body: input }),
  updateOption: (projectId, tagId, optionId, input) =>
    request(`/v1/projects/${projectId}/ticket-tags/${tagId}/options/${optionId}`, { method: "PATCH", body: input }),
  deleteOption: (projectId, tagId, optionId) =>
    request(`/v1/projects/${projectId}/ticket-tags/${tagId}/options/${optionId}`, { method: "DELETE" }),
});
