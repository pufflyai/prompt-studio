import { defineTextSource, params } from "@pstdio/sdk/extensions";
import { getTicketContent } from "./commands/get-ticket-content";
import { saveTicketContent } from "./commands/save-ticket-content";
import { ticketsCollection } from "./data/collections";
import { selectedDocumentFromResource, TICKET_BODY_DOCUMENT } from "./data/document-selection";
import { readTicketFileContent } from "./data/ticket-file-content";
import { TICKETS_COLLECTION } from "./data/ticket-records";

export const ticketText = defineTextSource({
  id: "ticket-document",
  params: { ticketId: params.text({ required: true }), documentId: params.text({ required: true }) },
  async resolve(ctx, { params: { ticketId, documentId } }) {
    const ticket = await ticketsCollection(ctx).get(ticketId);
    if (!ticket) throw new Error("Ticket unavailable");
    if (documentId === TICKET_BODY_DOCUMENT)
      return {
        source: { kind: "collection", collection: TICKETS_COLLECTION, id: ticket.id, field: "/content" },
        content: ticket.content,
        editable: true,
      };
    const file = ticket.files?.find(({ id }) => id === documentId);
    if (!file) throw new Error(`Document unavailable: ${documentId}`);
    return {
      source: { kind: "blob", id: file.blobId, identity: JSON.stringify([ticket.id, file.id]) },
      content: await readTicketFileContent(ctx.storage, ticket.id, file),
      editable: true,
    };
  },
  async project(ctx, { params: { ticketId, documentId }, content }) {
    const result = await saveTicketContent(ctx, {
      id: ticketId,
      resource: { type: "ticket", id: ticketId, metadata: { documentId } },
      content,
    });
    if (!result) throw new Error(`Document unavailable: ${documentId}`);
    return result;
  },
});

/** Attach the selected public source without changing command results or binary attachments. */
export const loadTicketText = async (
  ctx: Parameters<typeof getTicketContent>[0],
  input: Parameters<typeof getTicketContent>[1],
) => {
  const result = await getTicketContent(ctx, input);
  const ticketId = input.resource?.type === "ticket" ? input.resource.id : undefined;
  if (!ticketId || "dataUrl" in result) return result;
  return {
    ...result,
    textDocument: {
      sourceId: ticketText.id,
      params: { ticketId, documentId: selectedDocumentFromResource(input.resource) },
    },
  };
};
