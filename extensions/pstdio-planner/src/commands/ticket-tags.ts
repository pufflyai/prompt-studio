import { defineCommand, params } from "@pstdio/sdk/extensions";
import { resolveTagId } from "../data/resolve";
import {
  applyTagDraft,
  createTagOption,
  createTicketTag,
  deleteTagOption,
  deleteTicketTag,
  readTicketTags,
  setTicketTags,
  type TagDraftOptionCreate,
  type TagDraftOptionUpdate,
  updateTagOption,
  updateTicketTag,
} from "../data/tag-operations";

export const readTicketTagsCommand = defineCommand({
  title: "Read ticket tags",
  cli: { globalAliases: [["tags", "list"]], examples: ["pstdio tags list"] },
  async run(ctx, _commandParams) {
    return readTicketTags(ctx.storage);
  },
});

export const createTicketTagCommand = defineCommand({
  title: "Create ticket tag",
  cli: { globalAliases: [["tags", "create"]], examples: ["pstdio tags create --name Priority --type single_select"] },
  params: {
    name: params.text({ label: "Name", required: true }),
    type: params.text({ label: "Type", required: false }),
  },
  async run(ctx, commandParams) {
    const type = commandParams.type === "multi_select" ? "multi_select" : "single_select";
    return createTicketTag({ storage: ctx.storage, name: commandParams.name, type });
  },
});

export const updateTicketTagCommand = defineCommand({
  title: "Update ticket tag",
  params: {
    tagId: params.text({ label: "Tag", required: true }),
    name: params.text({ label: "Name", required: false }),
    type: params.text({ label: "Type", required: false }),
  },
  async run(ctx, commandParams) {
    const type =
      commandParams.type === "multi_select" || commandParams.type === "single_select" ? commandParams.type : undefined;
    return updateTicketTag({ storage: ctx.storage, tagId: commandParams.tagId, name: commandParams.name, type });
  },
});

export const deleteTicketTagCommand = defineCommand({
  title: "Delete ticket tag",
  cli: { globalAliases: [["tags", "delete"]], examples: ["pstdio tags delete --tag Priority"] },
  params: {
    tagId: params.text({ label: "Tag", required: false }),
    tag: params.text({ label: "Tag name", required: false }),
  },
  async run(ctx, commandParams) {
    const tagId = commandParams.tagId ?? (await resolveTagId(ctx.storage, commandParams.tag ?? ""));
    return deleteTicketTag({ storage: ctx.storage, tagId });
  },
});

export const createTagOptionCommand = defineCommand({
  title: "Create tag option",
  params: {
    tagId: params.text({ label: "Tag", required: true }),
    name: params.text({ label: "Name", required: true }),
    color: params.text({ label: "Color", required: false }),
    icon: params.text({ label: "Icon", required: false }),
    description: params.text({ label: "Description", required: false }),
  },
  async run(ctx, commandParams) {
    return createTagOption({
      storage: ctx.storage,
      tagId: commandParams.tagId,
      name: commandParams.name,
      color: commandParams.color,
      icon: commandParams.icon,
      description: commandParams.description,
    });
  },
});

export const updateTagOptionCommand = defineCommand({
  title: "Update tag option",
  params: {
    tagId: params.text({ label: "Tag", required: true }),
    optionId: params.text({ label: "Option", required: true }),
    name: params.text({ label: "Name", required: false }),
    color: params.text({ label: "Color", required: false }),
    sortOrder: params.number({ label: "Sort order", required: false }),
    icon: params.text({ label: "Icon", required: false }),
    description: params.text({ label: "Description", required: false }),
  },
  async run(ctx, commandParams) {
    return updateTagOption({
      storage: ctx.storage,
      tagId: commandParams.tagId,
      optionId: commandParams.optionId,
      name: commandParams.name,
      color: commandParams.color,
      sortOrder: commandParams.sortOrder,
      icon: commandParams.icon,
      description: commandParams.description,
    });
  },
});

export const deleteTagOptionCommand = defineCommand({
  title: "Delete tag option",
  params: {
    tagId: params.text({ label: "Tag", required: true }),
    optionId: params.text({ label: "Option", required: true }),
  },
  async run(ctx, commandParams) {
    return deleteTagOption({ storage: ctx.storage, tagId: commandParams.tagId, optionId: commandParams.optionId });
  },
});

export const applyTicketTagDraftCommand = defineCommand({
  title: "Apply ticket tag draft",
  params: {
    tagId: params.text({ label: "Tag", required: true }),
    name: params.text({ label: "Name", required: false }),
    type: params.text({ label: "Type", required: false }),
    optionsToCreate: params.json<TagDraftOptionCreate[]>(),
    optionsToUpdate: params.json<TagDraftOptionUpdate[]>(),
    optionIdsToDelete: params.json<string[]>(),
  },
  async run(ctx, commandParams) {
    const type =
      commandParams.type === "multi_select" || commandParams.type === "single_select" ? commandParams.type : undefined;
    return applyTagDraft({
      storage: ctx.storage,
      tagId: commandParams.tagId,
      name: commandParams.name,
      type,
      optionsToCreate: commandParams.optionsToCreate ?? [],
      optionsToUpdate: commandParams.optionsToUpdate ?? [],
      optionIdsToDelete: commandParams.optionIdsToDelete ?? [],
    });
  },
});

export const setTicketTagsCommand = defineCommand({
  title: "Set ticket tags",
  params: {
    rowId: params.text({ label: "Ticket", required: true }),
    tagIds: params.json<string[]>(),
  },
  async run(ctx, commandParams) {
    return setTicketTags({ storage: ctx.storage, ticketId: commandParams.rowId, tagIds: commandParams.tagIds ?? [] });
  },
});
