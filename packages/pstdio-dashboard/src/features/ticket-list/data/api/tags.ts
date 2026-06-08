import {
  executePlannerCommand,
  type PlannerTag,
  type PlannerTagOption,
  readPlannerTicketTags,
  toTicketTag,
} from "./planner";
import type { CreateProjectTicketTagInput, CreateTagOptionInput, UpdateTagOptionInput } from "./types";

export const getProjectTicketTags = async (projectId: string) => {
  const tags = await readPlannerTicketTags(projectId);
  return tags.map(toTicketTag);
};

export const createProjectTicketTag = async (projectId: string, input: CreateProjectTicketTagInput) => {
  const created = await executePlannerCommand<PlannerTag>(projectId, "ticketTag.create", {
    name: input.name,
    type: input.type,
  });

  for (const option of input.options ?? []) {
    await executePlannerCommand(projectId, "ticketTag.createOption", {
      tagId: created.id,
      name: option.name,
      color: option.color,
    });
  }

  const tags = await readPlannerTicketTags(projectId);
  return toTicketTag(tags.find((tag) => tag.id === created.id) ?? created);
};

export const updateProjectTicketTagDefinition = async (
  projectId: string,
  tagId: string,
  input: { name?: string; type?: string },
) => {
  const updated = await executePlannerCommand<PlannerTag>(projectId, "ticketTag.update", {
    tagId,
    name: input.name,
    type: input.type,
  });
  return toTicketTag(updated);
};

export const deleteProjectTicketTag = async (projectId: string, tagId: string) => {
  await executePlannerCommand(projectId, "ticketTag.delete", { tagId });
};

export const createTagOption = async (projectId: string, tagId: string, input: CreateTagOptionInput) => {
  return executePlannerCommand<PlannerTagOption>(projectId, "ticketTag.createOption", {
    tagId,
    name: input.name,
    color: input.color,
    icon: input.icon,
    description: input.description,
  });
};

export const updateTagOption = async (
  projectId: string,
  tagId: string,
  optionId: string,
  input: UpdateTagOptionInput,
) => {
  return executePlannerCommand<PlannerTag>(projectId, "ticketTag.updateOption", {
    tagId,
    optionId,
    name: input.name,
    color: input.color,
    sortOrder: input.sort_order,
    icon: input.icon,
    description: input.description,
  });
};

export const deleteTagOption = async (projectId: string, tagId: string, optionId: string) => {
  await executePlannerCommand(projectId, "ticketTag.deleteOption", { tagId, optionId });
};
