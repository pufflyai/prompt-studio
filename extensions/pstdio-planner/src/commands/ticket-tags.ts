import { defineCommand, params } from "@pstdio/sdk/extensions";
import { resolveTagId } from "../data/resolve";
import {
  createTagOption,
  createTicketTag,
  deleteTagOption,
  deleteTicketTag,
  readTicketTags,
  setTicketTags,
  updateTagOption,
  updateTicketTag,
} from "../data/tag-operations";

export const readTicketTagsCommand = defineCommand({
  title: "Read ticket tags",
  cli: { globalAliases: [["tags", "list"]], examples: ["pstdio tags list"] },
  async run(ctx) {
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
  async run(ctx) {
    const type = ctx.params.type === "multi_select" ? "multi_select" : "single_select";
    return createTicketTag({ storage: ctx.storage, name: ctx.params.name, type });
  },
});

export const updateTicketTagCommand = defineCommand({
  title: "Update ticket tag",
  params: {
    tagId: params.text({ label: "Tag", required: true }),
    name: params.text({ label: "Name", required: false }),
    type: params.text({ label: "Type", required: false }),
  },
  async run(ctx) {
    const type =
      ctx.params.type === "multi_select" || ctx.params.type === "single_select" ? ctx.params.type : undefined;
    return updateTicketTag({ storage: ctx.storage, tagId: ctx.params.tagId, name: ctx.params.name, type });
  },
});

export const deleteTicketTagCommand = defineCommand({
  title: "Delete ticket tag",
  cli: { globalAliases: [["tags", "delete"]], examples: ["pstdio tags delete --tag Priority"] },
  params: {
    tagId: params.text({ label: "Tag", required: false }),
    tag: params.text({ label: "Tag name", required: false }),
  },
  async run(ctx) {
    const tagId = ctx.params.tagId ?? (await resolveTagId(ctx.storage, ctx.params.tag ?? ""));
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
  async run(ctx) {
    return createTagOption({
      storage: ctx.storage,
      tagId: ctx.params.tagId,
      name: ctx.params.name,
      color: ctx.params.color,
      icon: ctx.params.icon,
      description: ctx.params.description,
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
  async run(ctx) {
    return updateTagOption({
      storage: ctx.storage,
      tagId: ctx.params.tagId,
      optionId: ctx.params.optionId,
      name: ctx.params.name,
      color: ctx.params.color,
      sortOrder: ctx.params.sortOrder,
      icon: ctx.params.icon,
      description: ctx.params.description,
    });
  },
});

export const deleteTagOptionCommand = defineCommand({
  title: "Delete tag option",
  params: {
    tagId: params.text({ label: "Tag", required: true }),
    optionId: params.text({ label: "Option", required: true }),
  },
  async run(ctx) {
    return deleteTagOption({ storage: ctx.storage, tagId: ctx.params.tagId, optionId: ctx.params.optionId });
  },
});

export const setTicketTagsCommand = defineCommand({
  title: "Set ticket tags",
  params: {
    rowId: params.text({ label: "Ticket", required: true }),
    tagIds: params.json<string[]>(),
  },
  async run(ctx) {
    return setTicketTags({ storage: ctx.storage, ticketId: ctx.params.rowId, tagIds: ctx.params.tagIds ?? [] });
  },
});
