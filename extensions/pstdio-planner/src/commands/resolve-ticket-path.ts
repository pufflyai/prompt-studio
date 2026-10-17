import { defineCommand, l10n, params } from "@pstdio/sdk/extensions";
import { readTicketsWithReviewState } from "../data/collections";
import { TICKETS_DIR, ticketFilesDir } from "../data/draft-storage";
import { ticketPageTarget } from "../data/ticket-page-target";
import { ticketResourceReference } from "../data/ticket-resource-hierarchy";

export const resolveTicketPathCommand = defineCommand({
  id: "resolve-ticket-path",
  title: l10n("commands.resolveTicketPath.title", "Resolve ticket path"),
  params: { path: params.text({ required: true }), workspaceId: params.text({ required: true }) },
  async run(ctx, input) {
    if (!input.path.startsWith(`${TICKETS_DIR}/`)) return null;
    const relative = input.path.slice(`${TICKETS_DIR}/`.length);
    const [shorthand, ...parts] = relative.split("/");
    const tickets = await readTicketsWithReviewState(ctx.storage);
    const ticket = tickets.find((ticket) => ticket.shorthand === shorthand);
    if (!ticket) return null;
    const suffix = parts.join("/");
    const document = [...(ticket.files ?? []), ...(ticket.attachments ?? [])].find(
      (file) => input.path === `${ticketFilesDir(shorthand)}/${file.name}`,
    );
    if (suffix !== "ticket.md" && !document) return null;
    const reference = ticketResourceReference(ticket, new Map(tickets.map((ticket) => [ticket.id, ticket])));
    const resource = {
      ...reference,
      projectId: ctx.projectId,
      icon: document ? "file-text" : "component",
      ...(document ? { label: document.name, metadata: { ...reference.metadata, documentId: document.id } } : {}),
    };
    const target = ticketPageTarget(resource);
    return { resource, target: document ? { ...target, parent: ticketPageTarget(reference) } : target };
  },
});
