import { type ExtensionContextBase, l10n, type TreeNode, type TreeRendererPageParams } from "@pstdio/sdk/extensions";
import { statusesCollection, ticketsCollection } from "../data/collections";
import { linkedWorkspacePage } from "../data/linked-workspaces";
import { queryTicketNavigationPage } from "../data/navigation-queries";
import { readTicketLinkedResourcePage } from "../data/ticket-linked-resources";
import { plannerOwnerFor, readTicketParentLookup, ticketResourceReference } from "../data/ticket-resource-hierarchy";
import { readTicketSessionPage } from "../data/ticket-session-page";
import { mergeTicketLinkSections, ticketRelationshipSections } from "./ticket-link-sections";
import { buildSessionsSection } from "./ticket-sessions-tree";
import { buildSubTicketsSection } from "./ticket-sub-tickets-tree";
import { buildWorkspacesSection } from "./ticket-workspaces-tree";

export const listTicketFilesPage = async (
  ctx: Pick<ExtensionContextBase, "storage" | "resources" | "extensionId" | "workspaces" | "projectId" | "sessions">,
  input: TreeRendererPageParams,
) => {
  const resource = input.renderer.resource;
  if (resource?.type !== "ticket" || input.parent.kind !== "section") return { nodes: [] };
  const section = input.parent.id;
  if (!["sub-tickets", "required-by", "workspaces", "sessions", "related"].includes(section)) return { nodes: [] };
  const ticket = await ticketsCollection(ctx).get(resource.id);
  if (!ticket) return { nodes: [] };
  if (section === "sessions") {
    const page = await readTicketSessionPage(ctx, ticket.id, input.cursor);
    return {
      nodes: buildSessionsSection({ sessions: [], workspaceSessions: page.items, ticketId: ticket.id }).nodes.filter(
        (node) => node.rowVariant !== "empty-state",
      ),
      nextCursor: page.nextCursor ?? undefined,
    };
  }
  if (section === "related") {
    const page = await readTicketLinkedResourcePage(
      ctx.resources,
      { type: "ticket", id: ticket.id, extensionId: plannerOwnerFor(ctx), projectId: ctx.projectId },
      input.cursor,
    );
    const sections = mergeTicketLinkSections(
      [{ id: "related", label: l10n("navigation.related", "Related resources"), nodes: [] }],
      page.items,
      ctx.projectId,
      plannerOwnerFor(ctx),
    );
    return { nodes: sections.flatMap(({ nodes }) => nodes), nextCursor: page.nextCursor };
  }
  if (section === "workspaces") {
    const page = await linkedWorkspacePage(ctx, [ticket], input.cursor);
    const lookup = await readTicketParentLookup(ctx, new Map([[ticket.id, ticket]]));
    const resourceParent = ticketResourceReference(ticket, lookup, plannerOwnerFor(ctx));
    return {
      nodes: buildWorkspacesSection(page.items, { resourceParent }, undefined).nodes,
      nextCursor: page.nextCursor,
    };
  }
  const page = await queryTicketNavigationPage(ctx, ticket, section as "sub-tickets" | "required-by", input.cursor);
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
