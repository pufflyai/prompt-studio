import { defineCommand, params } from "@pstdio/sdk/extensions";
import { findTicket } from "../data/resolve";

// Load command for the ticket-body file renderer. The host passes the open
// ticket as the bound resource; the id falls back to it. No fileName ⇒ the host
// renders the body as markdown.
export const getTicketContentCommand = defineCommand({
  title: "Get ticket content",
  params: { id: params.text() },
  async run(ctx) {
    const ticketId = ctx.params.id ?? (ctx.resource?.type === "ticket" ? ctx.resource.id : undefined);
    if (!ticketId) return { content: "" };
    const ticket = await findTicket(ctx.storage, ticketId);
    return { content: ticket?.content ?? "" };
  },
});
