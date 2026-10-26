import { defineCommand, params, type ResourceRef, type ResourceResolution } from "@pstdio/sdk/extensions";
import { ticketsCollection } from "../data/collections";
import { selectedDocumentFromResource, TICKET_BODY_DOCUMENT } from "../data/document-selection";
import { TICKET_RESOURCE_ICON } from "../data/mappers";
import {
  REVIEW_REQUESTS_DOCUMENT,
  ticketFileTarget,
  ticketPageTarget,
  ticketRequestsTarget,
} from "../data/ticket-page-target";
import { readTicketParentLookup, ticketResourceReference } from "../data/ticket-resource-hierarchy";
import { isImageAttachment } from "../utils/is-image-attachment";

export const resolveTicketResourcesCommand = defineCommand({
  id: "resolve-ticket-resources",
  title: "Resolve ticket resources",
  params: { resources: params.json<ResourceRef[]>() },
  async run(ctx, input) {
    const resources = input.resources ?? [];
    const ids = new Set(resources.filter((resource) => resource.type === "ticket").map((resource) => resource.id));
    const collection = ticketsCollection(ctx);
    const selected = [...ids];
    const tickets = await collection.getMany(selected);
    const byId = new Map(selected.map((id, index) => [id, tickets[index]]));
    const parentLookup = await readTicketParentLookup(ctx, byId);
    return resources.flatMap<ResourceResolution>((resource) => {
      const ticket = resource.type === "ticket" ? byId.get(resource.id) : undefined;
      if (!ticket) return [];
      const reference = {
        ...ticketResourceReference(ticket, parentLookup),
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
      const document = [...(ticket.files ?? []), ...(ticket.attachments ?? [])].find((file) => file.id === documentId);
      if (!document) return [];
      const target = ticketFileTarget(reference, document, isImageAttachment(document) ? "Image" : "FileText");
      return [{ resource: target.resource, target }];
    });
  },
});
