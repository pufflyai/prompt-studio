import type { TagOptionResponse, TagResponse } from "pstdio-api/dto";
import { toTicketTag } from "./mappers";
import { executePlannerCommand, listPlannerCollection, toPlannerTagResponses } from "./planner";
import type { CreateProjectTicketTagInput, CreateTagOptionInput, UpdateTagOptionInput } from "./types";

export const getProjectTicketTags = async (projectId: string) => {
  const [tagRows, optionRows] = await Promise.all([
    listPlannerCollection(projectId, "tags"),
    listPlannerCollection(projectId, "tag_options"),
  ]);
  const tags = toPlannerTagResponses(tagRows, optionRows);
  return tags.map(toTicketTag);
};

export const createProjectTicketTag = async (projectId: string, input: CreateProjectTicketTagInput) => {
  const created = await executePlannerCommand<TagResponse>(projectId, "createTag", input);
  return toTicketTag(created);
};

export const updateProjectTicketTagDefinition = async (
  projectId: string,
  tagId: string,
  input: { name?: string; type?: string },
) => {
  const updated = await executePlannerCommand<TagResponse>(projectId, "updateTag", { tag_id: tagId, ...input });
  return toTicketTag(updated);
};

export const deleteProjectTicketTag = async (projectId: string, tagId: string) => {
  await executePlannerCommand(projectId, "deleteTag", { tag_id: tagId });
};

export const createTagOption = async (projectId: string, tagId: string, input: CreateTagOptionInput) => {
  return executePlannerCommand<TagOptionResponse>(projectId, "createTagOption", { tag_id: tagId, ...input });
};

export const updateTagOption = async (
  projectId: string,
  tagId: string,
  optionId: string,
  input: UpdateTagOptionInput,
) => {
  return executePlannerCommand<TagOptionResponse>(projectId, "updateTagOption", {
    option_id: optionId,
    tag_id: tagId,
    name: input.name,
    color: input.color,
    sort_order: input.sort_order,
    icon: input.icon,
    description: input.description,
  });
};

export const deleteTagOption = async (projectId: string, tagId: string, optionId: string) => {
  await executePlannerCommand(projectId, "deleteTagOption", { tag_id: tagId, option_id: optionId });
};
