import { defineCommand, params } from "@pstdio/sdk/extensions";
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
  description: "Read the ticket tag definitions and their options.",
  async run(ctx) {
    return readTicketTags(ctx.storage);
  },
});

export const createTicketTagCommand = defineCommand({
  title: "Create ticket tag",
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
  params: { tagId: params.text({ label: "Tag", required: true }) },
  async run(ctx) {
    return deleteTicketTag({ storage: ctx.storage, tagId: ctx.params.tagId });
  },
});

export const createTagOptionCommand = defineCommand({
  title: "Create tag option",
  params: {
    tagId: params.text({ label: "Tag", required: true }),
    name: params.text({ label: "Name", required: true }),
    color: params.text({ label: "Color", required: false }),
  },
  async run(ctx) {
    return createTagOption({
      storage: ctx.storage,
      tagId: ctx.params.tagId,
      name: ctx.params.name,
      color: ctx.params.color,
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
  },
  async run(ctx) {
    return updateTagOption({
      storage: ctx.storage,
      tagId: ctx.params.tagId,
      optionId: ctx.params.optionId,
      name: ctx.params.name,
      color: ctx.params.color,
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
