import { TicketBoard, type TicketBoardColumn, type TicketBoardColumnAction, type TicketBoardItem } from "@pstdio/ui";
import { Archive } from "lucide-react";

import type { Ticket, TicketColumnAction, TicketStatus } from "@/features/ticket-list/types";

import type { BadgeContext, DisplayProperty, TicketGroup } from "../types";
import { buildTicketBadges } from "../utils/ticket-badges";
import { buildParentPath } from "../utils/ticket-parent-path";

interface TicketsBoardViewProps {
  groups: TicketGroup[];
  displayProperties: DisplayProperty[];
  badgeContext: BadgeContext;
  onMoveTicket?: (ticketId: string, nextStatus: TicketStatus) => void;
  onSelectTicket?: (ticket: Ticket) => void;
  onCreateStart?: (status: TicketStatus) => void;
  onColumnAction?: (status: TicketStatus, action: TicketColumnAction) => Promise<void> | void;
  selectedTicketId?: string | null;
}

const COLUMN_ACTION_MAP: Record<TicketColumnAction, Omit<TicketBoardColumnAction, "id">> = {
  archive_all: { label: "Archive all", icon: Archive },
};

const toColumnActions = (actions: TicketColumnAction[]): TicketBoardColumnAction[] =>
  actions.map((action) => ({ id: action, ...COLUMN_ACTION_MAP[action] }));

const toBoardItem = (
  ticket: Ticket,
  displayProperties: DisplayProperty[],
  badgeContext: BadgeContext,
  ticketsById: Map<string, Ticket>,
): TicketBoardItem => ({
  id: ticket.id,
  cardProps: {
    ticketId: ticket.shorthand,
    parentPath: buildParentPath(ticket, ticketsById),
    title: ticket.title || "empty ticket",
    badges: buildTicketBadges(ticket, displayProperties, badgeContext),
    onClick: undefined,
  },
});

export const TicketsBoardView = (props: TicketsBoardViewProps) => {
  const {
    groups,
    displayProperties,
    badgeContext,
    onMoveTicket,
    onSelectTicket,
    onCreateStart,
    onColumnAction,
    selectedTicketId = null,
  } = props;

  const ticketsById = new Map<string, Ticket>();
  for (const group of groups) {
    for (const ticket of group.tickets) {
      ticketsById.set(ticket.id, ticket);
    }
  }

  const columns: TicketBoardColumn[] = groups.map((group) => {
    const items = group.tickets.map((ticket) => {
      const item = toBoardItem(ticket, displayProperties, badgeContext, ticketsById);
      item.cardProps.onClick = () => onSelectTicket?.(ticket);
      return item;
    });

    return {
      id: group.id,
      label: group.label,
      color: group.color,
      items,
      canDragIn: group.canDragIn,
      canDragOut: group.canDragOut,
      canCreate: group.canCreate,
      actions: toColumnActions(group.columnActions),
    };
  });

  const handleMoveItem = (itemId: string, targetColumnId: string) => {
    onMoveTicket?.(itemId, targetColumnId);
  };

  const handleColumnAction = (columnId: string, actionId: string) => {
    onColumnAction?.(columnId, actionId as TicketColumnAction);
  };

  return (
    <TicketBoard
      columns={columns}
      selectedItemId={selectedTicketId}
      onMoveItem={handleMoveItem}
      onCreateStart={onCreateStart}
      onColumnAction={handleColumnAction}
    />
  );
};
