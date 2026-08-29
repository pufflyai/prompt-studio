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
  id: "ticket-tag.read",
  title: "Read ticket tags",
  cli: { globalAliases: [["tags", "list"]], examples: ["pstdio tags list"] },
  async run(ctx, _commandParams) {
    return readTicketTags(ctx.storage);
  },
});

export const createTicketTagCommand = defineCommand({
  id: "ticket-tag.create",
  mutating: true,
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
  id: "ticket-tag.update",
  mutating: true,
  title: "Update ticket tag",
  cli: {
    globalAliases: [["tags", "update"]],
    examples: ["pstdio tags update --tag-id default-priority --sort-order 0"],
  },
  params: {
    tagId: params.text({ label: "Tag", required: true }),
    name: params.text({ label: "Name", required: false }),
    type: params.text({ label: "Type", required: false }),
    sortOrder: params.number({ label: "Sort order", required: false }),
  },
  async run(ctx, commandParams) {
    const type =
      commandParams.type === "multi_select" || commandParams.type === "single_select" ? commandParams.type : undefined;
    return updateTicketTag({
      storage: ctx.storage,
      tagId: commandParams.tagId,
      name: commandParams.name,
      type,
      sortOrder: commandParams.sortOrder,
    });
  },
});

export const deleteTicketTagCommand = defineCommand({
  id: "ticket-tag.delete",
  mutating: true,
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
  id: "ticket-tag.create-option",
  mutating: true,
  title: "Create tag option",
  cli: {
    globalAliases: [["tags", "options", "create"]],
    examples: ["pstdio tags options create --tag-id default-priority --name Urgent --color red"],
  },
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
  id: "ticket-tag.update-option",
  mutating: true,
  title: "Update tag option",
  cli: {
    globalAliases: [["tags", "options", "update"]],
    examples: ["pstdio tags options update --tag-id default-priority --option-id default-priority-urgent --color red"],
  },
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
  id: "ticket-tag.delete-option",
  mutating: true,
  title: "Delete tag option",
  cli: {
    globalAliases: [["tags", "options", "delete"]],
    examples: ["pstdio tags options delete --tag-id default-priority --option-id default-priority-urgent"],
  },
  params: {
    tagId: params.text({ label: "Tag", required: true }),
    optionId: params.text({ label: "Option", required: true }),
  },
  async run(ctx, commandParams) {
    return deleteTagOption({ storage: ctx.storage, tagId: commandParams.tagId, optionId: commandParams.optionId });
  },
});

export const applyTicketTagDraftCommand = defineCommand({
  id: "ticket-tag.apply-draft",
  mutating: true,
  title: "Apply ticket tag draft",
  cli: {
    globalAliases: [["tags", "apply-draft"]],
    examples: [
      "pstdio tags apply-draft --tag-id default-priority --options-to-update '[]' --options-to-create '[]' --option-ids-to-delete '[]'",
    ],
  },
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
  id: "set-ticket-tags",
  mutating: true,
  title: "Set ticket tags",
  params: {
    rowId: params.text({ label: "Ticket", required: true }),
    tagIds: params.json<string[]>(),
  },
  async run(ctx, commandParams) {
    return setTicketTags({ storage: ctx.storage, ticketId: commandParams.rowId, tagIds: commandParams.tagIds ?? [] });
  },
});
