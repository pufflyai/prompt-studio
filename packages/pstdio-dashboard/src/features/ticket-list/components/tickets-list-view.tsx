import { TicketList, type TicketListItem } from "@pstdio/ui";
import { useTranslation } from "react-i18next";

import type { Ticket } from "@/features/ticket-list/types";

import type { BadgeContext, DisplayProperty, TicketGroup } from "../types";
import { buildTicketBadges } from "../utils/ticket-badges";

interface TicketsListViewProps {
  groups: TicketGroup[];
  displayProperties: DisplayProperty[];
  badgeContext: BadgeContext;
  emptyTicketLabel?: string;
  onMoveTicket?: (ticketId: string, targetStatus: string) => void;
  onSelectTicket?: (ticket: Ticket) => void;
  selectedTicketId?: string | null;
}

const toListItem = (input: {
  ticket: Ticket;
  displayProperties: DisplayProperty[];
  badgeContext: BadgeContext;
  emptyTicketLabel: string;
  onSelectTicket?: (ticket: Ticket) => void;
}): TicketListItem => {
  const { ticket, displayProperties, badgeContext, emptyTicketLabel, onSelectTicket } = input;

  return {
    id: ticket.id,
    ticketId: ticket.shorthand,
    title: ticket.title || emptyTicketLabel,
    badges: buildTicketBadges(ticket, displayProperties, badgeContext),
    date: new Date(ticket.updatedAt).toLocaleDateString(),
    onClick: () => onSelectTicket?.(ticket),
  };
};

export const buildGroupedListItems = (
  groups: TicketGroup[],
  displayProperties: DisplayProperty[],
  badgeContext: BadgeContext,
  emptyTicketLabel: string,
  onSelectTicket?: (ticket: Ticket) => void,
) => {
  return groups.map((group) => ({
    id: `group::${group.id}`,
    ticketId: "",
    title: `${group.label} (${group.tickets.length})`,
    children: group.tickets.map((ticket) =>
      toListItem({
        ticket,
        displayProperties,
        badgeContext,
        emptyTicketLabel,
        onSelectTicket,
      }),
    ),
  }));
};

export const buildListDragPermissionsFromGroups = (groups: TicketGroup[]) => {
  const draggableItemIds = new Set<string>();
  const dropTargetGroupIds = new Set<string>();

  for (const group of groups) {
    if (group.canDragOut) {
      for (const ticket of group.tickets) {
        draggableItemIds.add(ticket.id);
      }
    }

    if (group.canDragIn) {
      dropTargetGroupIds.add(`group::${group.id}`);
    }
  }

  return { draggableItemIds, dropTargetGroupIds };
};

export const TicketsListView = (props: TicketsListViewProps) => {
  const {
    groups,
    displayProperties,
    badgeContext,
    emptyTicketLabel,
    onMoveTicket,
    onSelectTicket,
    selectedTicketId = null,
  } = props;
  const { t } = useTranslation("tickets");

  const items = buildGroupedListItems(
    groups,
    displayProperties,
    badgeContext,
    emptyTicketLabel ?? t("listView.emptyTicket"),
    onSelectTicket,
  );

  const listDragPermissions = buildListDragPermissionsFromGroups(groups);

  const listDragEnabled =
    !!onMoveTicket && listDragPermissions.draggableItemIds.size > 0 && listDragPermissions.dropTargetGroupIds.size > 0;

  return (
    <TicketList
      items={items}
      selectedItemId={selectedTicketId}
      draggable={listDragEnabled}
      draggableItemIds={listDragPermissions.draggableItemIds}
      dropTargetGroupIds={listDragPermissions.dropTargetGroupIds}
      onMoveItem={onMoveTicket}
    />
  );
};
