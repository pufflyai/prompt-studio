import { TicketList, type TicketListItem } from "@pstdio/ui";
import { useTranslation } from "react-i18next";
import type { HeaderActionItem } from "@/features/plugin-actions/components/header-action-groups";

import type { Ticket } from "@/features/ticket-list/types";

import type { BadgeContext, DisplayProperty, TicketGroup } from "../types";
import { buildTicketBadges } from "../utils/ticket-badges";

interface TicketsListViewProps {
  groups: TicketGroup[];
  displayProperties: DisplayProperty[];
  badgeContext: BadgeContext;
  onSelectTicket?: (ticket: Ticket) => void;
  selectedTicketId?: string | null;
  resolveContextMenuActions?: (ticket: Ticket) => HeaderActionItem[];
}

export const TicketsListView = (props: TicketsListViewProps) => {
  const {
    groups,
    displayProperties,
    badgeContext,
    onSelectTicket,
    selectedTicketId = null,
    resolveContextMenuActions,
  } = props;
  const { t } = useTranslation("tickets");

  const toListItem = (ticket: Ticket, onSelect?: (ticket: Ticket) => void): TicketListItem => {
    const contextMenuActions = resolveContextMenuActions?.(ticket);

    return {
      id: ticket.id,
      ticketId: ticket.shorthand,
      title: ticket.title || t("listView.emptyTicket"),
      badges: buildTicketBadges(ticket, displayProperties, badgeContext),
      date: new Date(ticket.updatedAt).toLocaleDateString(),
      onClick: () => onSelect?.(ticket),
      ...(contextMenuActions ? { contextMenuActions } : {}),
    } as TicketListItem;
  };

  const items: TicketListItem[] = groups.flatMap((group) =>
    group.tickets.map((ticket) => toListItem(ticket, onSelectTicket)),
  );

  return <TicketList items={items} selectedItemId={selectedTicketId} />;
};
