import { defineCommand, l10n, params } from "@pstdio/sdk/extensions";
import { TICKETS_DIR, ticketFilesDir, ticketMarkdownPath, ticketPathPrefixes } from "../data/draft-storage";
import { ticketPageTarget } from "../data/ticket-page-target";
import { plannerOwnerFor, ticketResourceReference } from "../data/ticket-resource-hierarchy";
import { findTicketAncestors, findTicketsByShorthand } from "../data/ticket-shorthand-lookup";

export const resolveTicketPathCommand = defineCommand({
  id: "resolve-ticket-path",
  title: l10n("commands.resolveTicketPath.title", "Resolve ticket path"),
  params: { path: params.text({ required: true }), workspaceId: params.text({ required: true }) },
  async run(ctx, input) {
    const prefix = ticketPathPrefixes.find((prefix) => input.path.startsWith(prefix));
    if (!prefix) return null;
    const path = `${TICKETS_DIR}/${input.path.slice(prefix.length)}`;
    const [shorthand] = path.slice(`${TICKETS_DIR}/`.length).split("/");
    const tickets = shorthand ? await findTicketsByShorthand(ctx, shorthand) : [];
    const resolutions = (
      await Promise.all(
        tickets.map(async (ticket) => {
          const document = (ticket.files ?? []).find((file) => path === `${ticketFilesDir(shorthand)}/${file.name}`);
          if (path !== ticketMarkdownPath(shorthand) && !document) return null;
          const reference = ticketResourceReference(
            ticket,
            await findTicketAncestors(ctx, ticket),
            plannerOwnerFor(ctx),
          );
          const resource = {
            ...reference,
            projectId: ctx.projectId,
            icon: document ? "file-text" : "component",
            ...(document ? { label: document.name, metadata: { ...reference.metadata, documentId: document.id } } : {}),
          };
          const target = ticketPageTarget(resource);
          return { resource, target: document ? { ...target, parent: ticketPageTarget(reference) } : target };
        }),
      )
    ).filter((entry) => entry !== null);
    const first = resolutions[0];
    if (!first) return null;
    if (resolutions.length === 1) return first;
    return {
      resource: first.resource,
      target: {
        kind: "compound" as const,
        targets: resolutions.map(({ target }) => ({ ...target, open: "pin" as const })),
      },
    };
  },
});
