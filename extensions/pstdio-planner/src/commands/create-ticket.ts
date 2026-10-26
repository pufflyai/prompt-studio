import { defineCommand, params } from "@pstdio/sdk/extensions";
import { putTicket, ticketsCollection } from "../data/collections";
import { createTicketParentLookup, TICKET_RESOURCE_ICON } from "../data/mappers";
import { resolveDependencyIds, resolveStatusId, resolveTagOptionIds, resolveTicketId } from "../data/resolve";
import { seedDefaultStatuses, seedDefaultTags } from "../data/seed";
import { ticketTagsForIds } from "../data/tag-cardinality";
import { allocateTicketIdentity } from "../data/ticket-identity";
import { withTicketOrder } from "../data/ticket-order";
import { ticketResourceReference } from "../data/ticket-resource-hierarchy";
import { withTicketTagIds } from "../data/ticket-tags";
import type { StoredTicketAttachment } from "../data/types";
import { plannerTicketsChanged } from "../events";
import { deriveTitle } from "../utils/derive-title";

const ticketTitle = (input: { content?: string; title?: string }) =>
  input.content ? deriveTitle(input.content) : (input.title ?? "Untitled");

const attributeTagIds = (attributes: Record<string, unknown>) =>
  Object.entries(attributes).flatMap(([id, value]) => {
    if (id === "status" || id === "milestone") return [];
    if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
    return typeof value === "string" && value ? [value] : [];
  });

// Backs the board's "new ticket" and the `pst tickets create`/`add` CLI path. The
// board passes ids; the CLI passes human names/shorthands, so status, tags,
// parent, and dependencies are resolved server-side (Decision 3).
export const createTicketCommand = defineCommand({
  id: "create-ticket",
  mutating: true,
  title: "Create ticket",
  palette: [{}],
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
    dependsOn: params.list(),
  },
  async run(ctx, commandParams) {
    // Resolve before anything is written, so an unknown shorthand leaves no
    // half-created ticket and burns no shorthand.
    const dependsOn = commandParams.dependsOn ? await resolveDependencyIds(ctx, commandParams.dependsOn, []) : [];
    const statuses = await seedDefaultStatuses(ctx.storage);
    if (commandParams.tags !== undefined) await seedDefaultTags(ctx.storage);
    const attributes = commandParams.attributes ?? {};
    const tagIds =
      commandParams.tags !== undefined
        ? await resolveTagOptionIds(ctx.storage, commandParams.tags)
        : (commandParams.tagIds ?? attributeTagIds(attributes));
    const tags = await ticketTagsForIds(ctx.storage, tagIds);
    const defaultStatus = statuses.find((status) => status.isDefault) ?? statuses[0];
    const now = new Date().toISOString();
    const { id } = await allocateTicketIdentity(ctx);

    const attributeStatusId =
      typeof attributes.status === "string" && attributes.status ? attributes.status : undefined;

    const statusId =
      commandParams.status !== undefined
        ? await resolveStatusId(ctx.storage, commandParams.status)
        : (commandParams.statusId ?? attributeStatusId ?? defaultStatus?.id ?? null);
    const parentId =
      commandParams.parent !== undefined
        ? await resolveTicketId(ctx, commandParams.parent)
        : (commandParams.parentId ?? null);

    const { existing, ticket } = await withTicketOrder(ctx, async () => {
      const existing = await ticketsCollection(ctx).list();
      const sortOrder = Math.max(-1, ...existing.map((ticket) => ticket.sortOrder)) + 1;
      const ticket = await putTicket(ctx, {
        id,
        title: ticketTitle(commandParams),
        content: commandParams.content ?? "",
        statusId,
        tags,
        attachments: commandParams.attachments ?? [],
        parentId,
        dependsOn,
        blockedReason: null,
        userPrompt: null,
        draft: false,
        archived: false,
        sortOrder,
        createdAt: now,
        updatedAt: now,
      });
      return { existing, ticket };
    });
    await ctx.events.emit(plannerTicketsChanged, { ticketId: ticket.id });
    return {
      ...withTicketTagIds(ticket),
      resource: {
        ...ticketResourceReference(ticket, createTicketParentLookup([...existing, ticket])),
        projectId: ctx.projectId,
        icon: TICKET_RESOURCE_ICON,
      },
    };
  },
});
