import { defineCommand, params, serializePageUrl } from "@pstdio/sdk/extensions";
import { selectedDocumentFromResource, TICKET_BODY_DOCUMENT } from "../data/document-selection";
import { findTicket } from "../data/resolve";
import { ticketDocumentPage } from "../data/ticket-page-target";

export const documentLinkCommand = defineCommand({
  id: "document-link",
  title: "Get ticket document link",
  cli: {
    globalAliases: [["tickets", "document-link"]],
    examples: ["pstdio tickets document-link --id PS-1", "pstdio tickets document-link --id PS-1 --file research.md"],
  },
  params: {
    id: params.text({ label: "Ticket shorthand or UUID", resolvedFrom: "resource" }),
    file: params.text({ label: "Saved file name or ID" }),
  },
  async run(ctx, input) {
    const ticketId = input.id ?? (ctx.resource?.type === "ticket" ? ctx.resource.id : undefined);
    const ticket = ticketId ? await findTicket(ctx.storage, ticketId) : undefined;
    if (!ticket) throw new Error(`Ticket unavailable: ${ticketId ?? "no ticket selected"}`);
    const selected = input.file ?? (input.id ? TICKET_BODY_DOCUMENT : selectedDocumentFromResource(ctx.resource));
    const documents = [...(ticket.files ?? []), ...(ticket.attachments ?? [])];
    let document = documents.find((file) => file.id === selected);
    if (!document && selected !== TICKET_BODY_DOCUMENT) {
      const matches = documents.filter((file) => file.name === selected);
      if (matches.length > 1) throw new Error(`Document name is ambiguous: ${selected}. Use its ID.`);
      document = matches[0];
    }
    if (selected !== TICKET_BODY_DOCUMENT && !document) throw new Error(`Document unavailable: ${selected}`);
    return {
      href: serializePageUrl({
        projectId: ctx.projectId,
        page: ticketDocumentPage,
        resource: {
          type: "ticket",
          id: ticket.id,
          projectId: ctx.projectId,
          extensionId: "pstdio.pstdio-planner",
          ...(document ? { metadata: { documentId: document.id } } : {}),
        },
      }),
    };
  },
});
