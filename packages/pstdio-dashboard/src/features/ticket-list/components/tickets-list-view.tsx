import { DataRendererList, type DataRendererListItem, type ResourceContextAction } from "@pstdio/ui";
import { useTranslation } from "react-i18next";

import type { Ticket } from "@/features/ticket-list/types";

import type { BadgeContext, DisplayProperty, TicketGroup } from "../types";
import { buildTicketBadges } from "../utils/ticket-badges";

interface TicketsListViewProps {
  groups: TicketGroup[];
  displayProperties: DisplayProperty[];
  badgeContext: BadgeContext;
  onSelectTicket?: (ticket: Ticket) => void;
  selectedTicketId?: string | null;
  resolveContextMenuActions?: (ticket: Ticket) => ResourceContextAction[];
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

  const toListItem = (ticket: Ticket, onSelect?: (ticket: Ticket) => void): DataRendererListItem => {
    const contextMenuActions = resolveContextMenuActions?.(ticket);
    const title = ticket.title || t("listView.emptyTicket");

    return {
      id: ticket.id,
      title: `${ticket.shorthand} ${title}`,
      badges: buildTicketBadges(ticket, displayProperties, badgeContext),
      onClick: () => onSelect?.(ticket),
      ...(contextMenuActions ? { contextMenuActions } : {}),
    };
  };

  const items: DataRendererListItem[] = groups.flatMap((group) =>
    group.tickets.map((ticket) => toListItem(ticket, onSelectTicket)),
  );

  return <DataRendererList items={items} selectedItemId={selectedTicketId} />;
};
