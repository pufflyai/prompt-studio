import { defineCommand, params } from "@pstdio/sdk/extensions";
import { putTicket, ticketsCollection } from "../data/collections";
import { createTicketParentLookup, TICKET_RESOURCE_ICON } from "../data/mappers";
import { resolveStatusId, resolveTagOptionIds } from "../data/resolve";
import { seedDefaultStatuses, seedDefaultTags } from "../data/seed";
import { ticketResourceReference } from "../data/ticket-resource-hierarchy";
import type { StoredTicketAttachment } from "../data/types";
import { plannerTicketsChanged } from "../events";
import { prepareTicketIdentities } from "../migrations/ticket-identities/references";
import { deriveTitle } from "../utils/derive-title";

// Backs the board's "new ticket" and the `pst tickets create`/`add` CLI path. The
// board passes ids; the CLI passes human names/shorthands, so status, tags,
// parent, and dependencies are resolved server-side (Decision 3).
export const createTicketCommand = defineCommand({
  id: "create-ticket",
  mutating: true,
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
    dependsOn: params.list(),
  },
  async run(ctx, commandParams) {
    const statuses = await seedDefaultStatuses(ctx.storage);
    if (commandParams.tags !== undefined) await seedDefaultTags(ctx.storage);
    const defaultStatus = statuses.find((status) => status.isDefault) ?? statuses[0];
    const now = new Date().toISOString();

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
    // Temporary ticket identity migration (ADR 0047). When it is removed, resolve `parent` with
    // resolveTicketId and `dependsOn` with resolveDependencyIds again.
    const identities = await prepareTicketIdentities(ctx, commandParams);
    const parentId = identities.parentId ?? commandParams.parentId ?? null;

    const { id, shorthand } = await ctx.resources.allocate({ kind: "ticket" });
    const existing = await ticketsCollection(ctx.storage).list();
    const sortOrder = Math.max(-1, ...existing.map((ticket) => ticket.sortOrder)) + 1;

    const ticket = await putTicket(ctx.storage, {
      id,
      shorthand,
      title: commandParams.content ? deriveTitle(commandParams.content) : (commandParams.title ?? "Untitled"),
      content: commandParams.content ?? "",
      statusId,
      tagIds,
      attachments: commandParams.attachments ?? [],
      parentId,
      dependsOn: identities.dependsOn,
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
