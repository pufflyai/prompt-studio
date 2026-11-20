import { defineCommand, l10n, params, type ResourceRef, type ResourceResolution } from "@pstdio/sdk/extensions";
import { ticketsCollection } from "../data/collections";
import { selectedDocumentFromResource, TICKET_BODY_DOCUMENT } from "../data/document-selection";
import { TICKET_RESOURCE_ICON } from "../data/mappers";
import { readTicketOpeningSummaries } from "../data/ticket-opening-summaries";
import {
  REVIEW_REQUESTS_DOCUMENT,
  ticketFileTarget,
  ticketPageTarget,
  ticketRequestsTarget,
} from "../data/ticket-page-target";
import { plannerOwnerFor, readTicketParentLookup, ticketResourceReference } from "../data/ticket-resource-hierarchy";
import { isImageAttachment } from "../utils/is-image-attachment";

export const resolveTicketResourcesCommand = defineCommand({
  id: "resolve-ticket-resources",
  title: "Resolve ticket resources",
  params: { resources: params.json<ResourceRef[]>() },
  async run(ctx, input) {
    const resources = input.resources ?? [];
    const ids = new Set(resources.filter((resource) => resource.type === "ticket").map((resource) => resource.id));
    const selected = [...ids];
    const summaryOnly = resources.every(
      (resource) =>
        resource.type !== "ticket" ||
        [TICKET_BODY_DOCUMENT, REVIEW_REQUESTS_DOCUMENT].includes(selectedDocumentFromResource(resource)),
    );
    const tickets = summaryOnly ? undefined : await ticketsCollection(ctx).getMany(selected);
    const fullById = tickets && new Map(selected.map((id, index) => [id, tickets[index]]));
    const { byId, parentLookup } = fullById
      ? { byId: fullById, parentLookup: await readTicketParentLookup(ctx, fullById) }
      : await readTicketOpeningSummaries(ctx, selected);
    return resources.flatMap<ResourceResolution>((resource) => {
      const ticket = resource.type === "ticket" ? byId.get(resource.id) : undefined;
      if (!ticket) return [];
      const reference = {
        ...ticketResourceReference(ticket, parentLookup, plannerOwnerFor(ctx)),
        icon: TICKET_RESOURCE_ICON,
        projectId: ctx.projectId,
        extensionId: ctx.extensionId,
      };
      const documentId = selectedDocumentFromResource(resource);
      if (documentId === TICKET_BODY_DOCUMENT) return [{ resource: reference, target: ticketPageTarget(reference) }];
      if (documentId === REVIEW_REQUESTS_DOCUMENT) {
        const target = ticketRequestsTarget(reference);
        return [{ resource: target.resource!, target }];
      }
      const full = fullById?.get(resource.id);
      const document = [...(full?.files ?? []), ...(full?.attachments ?? [])].find((file) => file.id === documentId);
      if (!document) return [];
      const target = ticketFileTarget(reference, document, isImageAttachment(document) ? "Image" : "FileText");
      return [{ resource: target.resource, target }];
    });
  },
});

export const resolveTicketOpeningCommand = defineCommand({
  id: "resolve-ticket-opening",
  title: l10n("commands.resolveTicketOpening", "Resolve ticket opening"),
  cli: true,
  async run(ctx) {
    if (!ctx.resource) return null;
    return (await resolveTicketResourcesCommand.run(ctx, { resources: [ctx.resource] }))[0]?.target ?? null;
  },
});
