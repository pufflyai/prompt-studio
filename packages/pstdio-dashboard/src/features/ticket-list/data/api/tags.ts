import type { TagResponse } from "pstdio-api/dto";
import { apiRequest } from "@/lib/api";
import { toTicketTag } from "./mappers";
import type { CreateProjectTicketTagInput } from "./types";

export const getProjectTicketTags = async (projectId: string) => {
  const tags = await apiRequest<TagResponse[]>(`/v1/projects/${projectId}/ticket-tags`);
  return tags.map(toTicketTag);
};

export const createProjectTicketTag = async (projectId: string, input: CreateProjectTicketTagInput) => {
  const created = await apiRequest<TagResponse>(`/v1/projects/${projectId}/ticket-tags`, {
    method: "POST",
    body: { name: input.name, color: input.color },
  });

  return toTicketTag(created);
};

export const updateProjectTicketTagDefinition = async (
  projectId: string,
  tagId: string,
  input: CreateProjectTicketTagInput,
) => {
  const updated = await apiRequest<TagResponse>(`/v1/projects/${projectId}/ticket-tags/${tagId}`, {
    method: "PUT",
    body: { name: input.name, color: input.color },
  });

  return toTicketTag(updated);
};

export const deleteProjectTicketTag = async (projectId: string, tagId: string) => {
  await apiRequest(`/v1/projects/${projectId}/ticket-tags/${tagId}`, { method: "DELETE" });
};
