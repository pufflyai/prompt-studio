import { defineCommand, params } from "@pstdio/sdk/extensions";
import { allocateTicketIdentity, putTicket, ticketsCollection } from "../data/collections";
import { resolveStatusId, resolveTagOptionIds, resolveTicketId } from "../data/resolve";
import { seedDefaultStatuses, seedDefaultTags } from "../data/seed";
import type { StoredTicketAttachment } from "../data/types";
import { plannerTicketsChanged } from "../events";
import { deriveTitle } from "../utils/derive-title";

// Backs the board's "new ticket" and the `pst tickets create`/`add` CLI path. The
// board passes ids; the CLI passes human names/shorthands, so status/tags/parent
// are resolved server-side (Decision 3).
export const createTicketCommand = defineCommand({
  title: "Create ticket",
  cli: {
    globalAliases: [
      ["tickets", "create"],
      ["tickets", "add"],
    ],
    examples: ["pstdio tickets create --content '# Title' --status TODO --tags High"],
  },
  params: {
    title: params.text(),
    content: params.longText(),
    statusId: params.text(),
    status: params.text(),
    tagIds: params.json<string[]>(),
    tags: params.list(),
    // The board's create form submits every editable attribute in one object
    // keyed by attribute id: `status` plus one entry per tag attribute.
    attributes: params.json<Record<string, unknown>>(),
    attachments: params.json<StoredTicketAttachment[]>(),
    parentId: params.text(),
    parent: params.text(),
  },
  async run(ctx) {
    const existing = await ticketsCollection(ctx.storage).list();
    const statuses = await seedDefaultStatuses(ctx.storage);
    if (ctx.params.tags !== undefined) await seedDefaultTags(ctx.storage);
    const defaultStatus = statuses.find((status) => status.isDefault) ?? statuses[0];
    const now = new Date().toISOString();
    const { shorthand, sortOrder } = allocateTicketIdentity(ctx.project.shorthand, existing);

    const attributes = ctx.params.attributes ?? {};
    const attributeStatusId = typeof attributes.status === "string" ? attributes.status : undefined;
    // Every attribute other than `status` is a tag attribute; its value is one
    // option id or a list of them.
    const attributeTagIds = Object.entries(attributes).flatMap(([attributeId, value]) => {
      if (attributeId === "status") return [];
      if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
      return typeof value === "string" && value ? [value] : [];
    });

    const statusId =
      ctx.params.status !== undefined
        ? await resolveStatusId(ctx.storage, ctx.params.status)
        : (ctx.params.statusId ?? attributeStatusId ?? defaultStatus?.id ?? null);
    const tagIds =
      ctx.params.tags !== undefined
        ? await resolveTagOptionIds(ctx.storage, ctx.params.tags)
        : (ctx.params.tagIds ?? attributeTagIds);
    const parentId =
      ctx.params.parent !== undefined
        ? await resolveTicketId(ctx.storage, ctx.params.parent)
        : (ctx.params.parentId ?? null);

    const ticket = await putTicket(ctx.storage, {
      id: crypto.randomUUID(),
      shorthand,
      title: ctx.params.content ? deriveTitle(ctx.params.content) : (ctx.params.title ?? "Untitled"),
      content: ctx.params.content ?? "",
      statusId,
      tagIds,
      attachments: ctx.params.attachments ?? [],
      parentId,
      dependsOn: [],
      blockedReason: null,
      userPrompt: null,
      parallelizable: null,
      draft: false,
      archived: false,
      sortOrder,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.events.emit(plannerTicketsChanged, { ticketId: ticket.id });
    return ticket;
  },
});
