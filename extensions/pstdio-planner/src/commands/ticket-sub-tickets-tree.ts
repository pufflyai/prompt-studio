import type { TreeNode, TreeViewSection } from "@pstdio/sdk/extensions";
import { ticketDisplayTitle } from "../data/mappers";
import { ticketResourceHierarchyMetadata } from "../data/ticket-resource-hierarchy";
import type { StoredStatus, StoredTicket } from "../data/types";

const ticketShorthandSort = (left: StoredTicket, right: StoredTicket) =>
  left.shorthand.localeCompare(right.shorthand, undefined, { numeric: true });

const subTicketStatus = (ticket: StoredTicket, statusesById: Map<string, StoredStatus>) => {
  if (!ticket.statusId) return undefined;
  return statusesById.get(ticket.statusId);
};

const subTicketNode = (
  ticket: StoredTicket,
  statusesById: Map<string, StoredStatus>,
  ticketsById: Map<string, StoredTicket>,
): TreeNode => {
  const status = subTicketStatus(ticket, statusesById);
  const label = ticketDisplayTitle(ticket);

  return {
    id: `ticket-${ticket.id}`,
    label,
    icon: "Component",
    iconColor: status?.color ? `${status.color}.fg` : "fg.muted",
    iconTooltip: status?.name,
    target: {
      kind: "resource",
      resource: {
        type: "ticket",
        id: ticket.id,
        label,
        metadata: ticketResourceHierarchyMetadata(ticket, ticketsById),
      },
    },
  };
};

export const buildSubTicketsSection = (input: {
  tickets: StoredTicket[];
  parentTicketId: string;
  statusesById: Map<string, StoredStatus>;
}): TreeViewSection | undefined => {
  const ticketsById = new Map(input.tickets.map((ticket) => [ticket.id, ticket]));
  const nodes = input.tickets
    .filter((ticket) => !ticket.archived && ticket.parentId === input.parentTicketId)
    .sort(ticketShorthandSort)
    .map((ticket) => subTicketNode(ticket, input.statusesById, ticketsById));

  if (nodes.length === 0) return undefined;

  return {
    id: "sub-tickets",
    label: "Sub-tickets",
    collapsible: true,
    canHide: true,
    nodes,
  };
};
