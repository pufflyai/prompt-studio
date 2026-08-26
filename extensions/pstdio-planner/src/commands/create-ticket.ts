import { defineCommand, params } from "@pstdio/sdk/extensions";
import { allocateTicketIdentity, putTicket, ticketsCollection } from "../data/collections";
import { createTicketParentLookup, TICKET_RESOURCE_ICON } from "../data/mappers";
import { resolveStatusId, resolveTagOptionIds, resolveTicketId } from "../data/resolve";
import { seedDefaultStatuses, seedDefaultTags } from "../data/seed";
import { ticketResourceReference } from "../data/ticket-resource-hierarchy";
import type { StoredTicketAttachment } from "../data/types";
import { plannerTicketsChanged } from "../events";
import { deriveTitle } from "../utils/derive-title";

// Backs the board's "new ticket" and the `pst tickets create`/`add` CLI path. The
// board passes ids; the CLI passes human names/shorthands, so status/tags/parent
// are resolved server-side (Decision 3).
export const createTicketCommand = defineCommand({
  id: "create-ticket",
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
  async run(ctx, commandParams) {
    const existing = await ticketsCollection(ctx.storage).list();
    const statuses = await seedDefaultStatuses(ctx.storage);
    if (commandParams.tags !== undefined) await seedDefaultTags(ctx.storage);
    const defaultStatus = statuses.find((status) => status.isDefault) ?? statuses[0];
    const now = new Date().toISOString();
    const { shorthand, sortOrder } = allocateTicketIdentity(ctx.project.shorthand, existing);

    const attributes = commandParams.attributes ?? {};
    const attributeStatusId = typeof attributes.status === "string" ? attributes.status : undefined;
    // Every attribute other than `status` is a tag attribute; its value is one
    // option id or a list of them.
    const attributeTagIds = Object.entries(attributes).flatMap(([attributeId, value]) => {
      if (attributeId === "status") return [];
      if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
      return typeof value === "string" && value ? [value] : [];
    });

    const statusId =
      commandParams.status !== undefined
        ? await resolveStatusId(ctx.storage, commandParams.status)
        : (commandParams.statusId ?? attributeStatusId ?? defaultStatus?.id ?? null);
    const tagIds =
      commandParams.tags !== undefined
        ? await resolveTagOptionIds(ctx.storage, commandParams.tags)
        : (commandParams.tagIds ?? attributeTagIds);
    const parentId =
      commandParams.parent !== undefined
        ? await resolveTicketId(ctx.storage, commandParams.parent)
        : (commandParams.parentId ?? null);

    const ticket = await putTicket(ctx.storage, {
      id: crypto.randomUUID(),
      shorthand,
      title: commandParams.content ? deriveTitle(commandParams.content) : (commandParams.title ?? "Untitled"),
      content: commandParams.content ?? "",
      statusId,
      tagIds,
      attachments: commandParams.attachments ?? [],
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
    return {
      ...ticket,
      resource: {
        ...ticketResourceReference(ticket, createTicketParentLookup([...existing, ticket])),
        projectId: ctx.projectId,
        icon: TICKET_RESOURCE_ICON,
      },
    };
  },
});
