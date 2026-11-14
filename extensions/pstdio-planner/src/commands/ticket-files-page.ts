import type { ExtensionContextBase, TreeNode, TreeRendererPageParams } from "@pstdio/sdk/extensions";
import { statusesCollection, ticketsCollection } from "../data/collections";
import { queryTicketNavigationPage } from "../data/navigation-queries";
import { plannerOwnerFor, readTicketParentLookup } from "../data/ticket-resource-hierarchy";
import { ticketRelationshipSections } from "./ticket-link-sections";
import { buildSubTicketsSection } from "./ticket-sub-tickets-tree";

export const listTicketFilesPage = async (
  ctx: Pick<ExtensionContextBase, "storage" | "resources" | "extensionId">,
  input: TreeRendererPageParams,
) => {
  const resource = input.renderer.resource;
  if (resource?.type !== "ticket" || input.parent.kind !== "section") return { nodes: [] };
  const section = input.parent.id;
  if (section !== "sub-tickets" && section !== "required-by") return { nodes: [] };
  const ticket = await ticketsCollection(ctx).get(resource.id);
  if (!ticket) return { nodes: [] };
  const page = await queryTicketNavigationPage(ctx, ticket, section, input.cursor);
  const lookup = await readTicketParentLookup(ctx, new Map([ticket, ...page.tickets].map((row) => [row.id, row])));
  const tickets = [...lookup.values()];
  let nodes: TreeNode[];
  if (section === "sub-tickets") {
    const statuses = await statusesCollection(ctx.storage).list();
    nodes =
      buildSubTicketsSection({
        tickets,
        children: page.tickets,
        parentTicketId: ticket.id,
        statusesById: new Map(statuses.map((status) => [status.id, status])),
      })?.nodes ?? [];
  } else {
    nodes =
      ticketRelationshipSections(ticket, tickets, plannerOwnerFor(ctx), page.tickets).find(({ id }) => id === section)
        ?.nodes ?? [];
  }
  return { nodes, ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}) };
};
