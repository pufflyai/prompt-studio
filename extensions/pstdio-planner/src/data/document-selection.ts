// Which document the ticket editor shows — the body or one of the ticket's files.
// Ephemeral per-ticket UI state: the files tree sets it, the editor's load/save
// read it. Resets to the body on restart (and for a never-opened ticket).

export const TICKET_BODY_DOCUMENT = "__ticket__";

const selectionByTicket = new Map<string, string>();

export const setSelectedDocument = (ticketId: string, documentId: string) => {
  selectionByTicket.set(ticketId, documentId);
};

export const getSelectedDocument = (ticketId: string) => selectionByTicket.get(ticketId) ?? TICKET_BODY_DOCUMENT;
