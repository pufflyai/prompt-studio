import { DataRendererList, type DataRendererListItem, type ResourceContextAction } from "@pstdio/ui";
import { useTranslation } from "react-i18next";

import type { Ticket } from "@/features/ticket-list/types";

import type { BadgeContext, DisplayProperty, TicketGroup } from "../types";
import { buildTicketBadges } from "../utils/ticket-badges";

interface TicketsListViewProps {
  groups: TicketGroup[];
  displayProperties: DisplayProperty[];
  badgeContext: BadgeContext;
  onMoveTicket?: (ticketId: string, nextStatus: string) => void;
  onSelectTicket?: (ticket: Ticket) => void;
  selectedTicketId?: string | null;
  resolveContextMenuActions?: (ticket: Ticket) => ResourceContextAction[];
}

export const TicketsListView = (props: TicketsListViewProps) => {
  const {
    groups,
    displayProperties,
    badgeContext,
    onMoveTicket,
    onSelectTicket,
    selectedTicketId = null,
    resolveContextMenuActions,
  } = props;
  const { t } = useTranslation("tickets");

  const toListItem = (
    ticket: Ticket,
    group: TicketGroup,
    onSelect?: (ticket: Ticket) => void,
  ): DataRendererListItem => {
    const contextMenuActions = resolveContextMenuActions?.(ticket);
    const title = ticket.title || t("listView.emptyTicket");

    return {
      id: ticket.id,
      title: `${ticket.shorthand} ${title}`,
      badges: buildTicketBadges(ticket, displayProperties, badgeContext),
      onClick: () => onSelect?.(ticket),
      draggable: Boolean(onMoveTicket && group.canDragOut),
      onDropRow: onMoveTicket && group.canDragIn ? (draggedId: string) => onMoveTicket(draggedId, group.id) : undefined,
      ...(contextMenuActions ? { contextMenuActions } : {}),
    };
  };

  const items: DataRendererListItem[] = groups.map((group) => ({
    id: `group:${group.id}`,
    title: group.label,
    countBadge: group.tickets.length,
    countColorPalette: group.color,
    onDropRow: onMoveTicket && group.canDragIn ? (ticketId: string) => onMoveTicket(ticketId, group.id) : undefined,
    children: group.tickets.map((ticket) => toListItem(ticket, group, onSelectTicket)),
  }));

  return <DataRendererList items={items} selectedItemId={selectedTicketId} />;
};
