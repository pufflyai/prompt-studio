import type { TagOption as TagOptionResponse, Tag as TagResponse } from "pstdio-api-contracts";
import { apiRequest } from "@/lib/api";
import { toTicketTag } from "./mappers";
import type { CreateProjectTicketTagInput, CreateTagOptionInput, UpdateTagOptionInput } from "./types";

export const getProjectTicketTags = async (projectId: string) => {
  const tags = await apiRequest<TagResponse[]>(`/v1/projects/${projectId}/ticket-tags`);
  return tags.map(toTicketTag);
};

export const createProjectTicketTag = async (projectId: string, input: CreateProjectTicketTagInput) => {
  const created = await apiRequest<TagResponse>(`/v1/projects/${projectId}/ticket-tags`, {
    method: "POST",
    body: input,
  });
  return toTicketTag(created);
};

export const updateProjectTicketTagDefinition = async (
  projectId: string,
  tagId: string,
  input: { name?: string; type?: string },
) => {
  const updated = await apiRequest<TagResponse>(`/v1/projects/${projectId}/ticket-tags/${tagId}`, {
    method: "PUT",
    body: input,
  });
  return toTicketTag(updated);
};

export const deleteProjectTicketTag = async (projectId: string, tagId: string) => {
  await apiRequest(`/v1/projects/${projectId}/ticket-tags/${tagId}`, { method: "DELETE" });
};

export const createTagOption = async (projectId: string, tagId: string, input: CreateTagOptionInput) => {
  return apiRequest<TagOptionResponse>(`/v1/projects/${projectId}/ticket-tags/${tagId}/options`, {
    method: "POST",
    body: input,
  });
};

export const updateTagOption = async (
  projectId: string,
  tagId: string,
  optionId: string,
  input: UpdateTagOptionInput,
) => {
  return apiRequest<TagOptionResponse>(`/v1/projects/${projectId}/ticket-tags/${tagId}/options/${optionId}`, {
    method: "PUT",
    body: {
      name: input.name,
      color: input.color,
      sort_order: input.sort_order,
      icon: input.icon,
      description: input.description,
    },
  });
};

export const deleteTagOption = async (projectId: string, tagId: string, optionId: string) => {
  await apiRequest(`/v1/projects/${projectId}/ticket-tags/${tagId}/options/${optionId}`, { method: "DELETE" });
};
