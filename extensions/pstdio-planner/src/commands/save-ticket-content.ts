import { defineCommand, type ExtensionContextBase, params, type ResourceRef } from "@pstdio/sdk/extensions";
import { ticketsCollection } from "../data/collections";
import { selectedDocumentFromResource, TICKET_BODY_DOCUMENT } from "../data/document-selection";
import { updateTicketFile } from "../data/file-operations";
import { findTicket } from "../data/resolve";
import { plannerTicketsChanged } from "../events";
import { deriveTitle } from "../utils/derive-title";

export const saveTicketContent = async (
  ctx: Pick<ExtensionContextBase, "events" | "storage">,
  input: { id?: string; content: string; resource?: ResourceRef },
) => {
  const ticketId = input.id ?? (input.resource?.type === "ticket" ? input.resource.id : undefined);
  if (!ticketId) return null;
  const existing = await findTicket(ctx.storage, ticketId);
  if (!existing) return null;

  const documentId = selectedDocumentFromResource(input.resource);
  if (documentId !== TICKET_BODY_DOCUMENT && existing.files?.some((file) => file.id === documentId)) {
    const ticket = await updateTicketFile({
      storage: ctx.storage,
      ticketId: existing.id,
      fileId: documentId,
      content: input.content,
    });
    await ctx.events.emit(plannerTicketsChanged, { ticketId: existing.id });
    return ticket ? { revision: ticket.updatedAt } : null;
  }

  const next = {
    ...existing,
    content: input.content,
    title: deriveTitle(input.content),
    updatedAt: new Date().toISOString(),
  };
  await ticketsCollection(ctx.storage).put(existing.id, next);
  await ctx.events.emit(plannerTicketsChanged, { ticketId: existing.id });
  return { revision: next.updatedAt };
};

// Save command for the ticket editor. Writes to whichever document the files tree
// has selected — the body (re-deriving the title) or the selected file.
export const saveTicketContentCommand = defineCommand({
  title: "Save ticket content",
  params: { id: params.text(), content: params.longText({ required: true }) },
  async run(ctx, commandParams) {
    return saveTicketContent(ctx, { ...commandParams, resource: ctx.resource });
  },
});
