import { TicketList, type TicketListItem } from "@pstdio/ui";

import type { Ticket } from "@/features/ticket-list/types";

import type { BadgeContext, DisplayProperty, TicketGroup } from "../types";
import { buildTicketBadges } from "../utils/ticket-badges";

interface TicketsListViewProps {
  groups: TicketGroup[];
  displayProperties: DisplayProperty[];
  badgeContext: BadgeContext;
  onSelectTicket?: (ticket: Ticket) => void;
  selectedTicketId?: string | null;
}

const toListItem = (
  ticket: Ticket,
  displayProperties: DisplayProperty[],
  badgeContext: BadgeContext,
  onSelectTicket?: (ticket: Ticket) => void,
): TicketListItem => ({
  id: ticket.id,
  ticketId: ticket.shorthand,
  title: ticket.title || "empty ticket",
  badges: buildTicketBadges(ticket, displayProperties, badgeContext),
  date: new Date(ticket.updatedAt).toLocaleDateString(),
  onClick: () => onSelectTicket?.(ticket),
});

export const TicketsListView = (props: TicketsListViewProps) => {
  const { groups, displayProperties, badgeContext, onSelectTicket, selectedTicketId = null } = props;

  const items: TicketListItem[] = groups.flatMap((group) =>
    group.tickets.map((ticket) => toListItem(ticket, displayProperties, badgeContext, onSelectTicket)),
  );

  return <TicketList items={items} selectedItemId={selectedTicketId} />;
};
