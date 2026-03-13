import { TicketBoard, type TicketBoardColumn, type TicketBoardColumnAction, type TicketBoardItem } from "@pstdio/ui";
import { Archive } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { Ticket, TicketAttempt, TicketColumnAction, TicketStatus } from "@/features/ticket-list/types";

import type { BadgeContext, DisplayProperty, TicketGroup } from "../types";
import { toSessionIndicatorStatus } from "../utils/ticket-attempts";
import { buildTicketBadges } from "../utils/ticket-badges";
import { buildParentPath } from "../utils/ticket-parent-path";

interface TicketsBoardViewProps {
  groups: TicketGroup[];
  displayProperties: DisplayProperty[];
  badgeContext: BadgeContext;
  latestAttemptsByTicketId?: Map<string, TicketAttempt>;
  diffTotalsByWorkspaceId?: Map<string, { additions: number; deletions: number }>;
  onMoveTicket?: (ticketId: string, nextStatus: TicketStatus) => void;
  onSelectTicket?: (ticket: Ticket) => void;
  onOpenSessionBubble?: (sessionId: string | null) => void;
  onOpenTicketWorkspace?: (ticket: Ticket, workspaceShorthand: string) => void;
  onCreateStart?: (status: TicketStatus) => void;
  onColumnAction?: (status: TicketStatus, action: TicketColumnAction) => Promise<void> | void;
  selectedTicketId?: string | null;
}

export const TicketsBoardView = (props: TicketsBoardViewProps) => {
  const {
    groups,
    displayProperties,
    badgeContext,
    latestAttemptsByTicketId = new Map(),
    diffTotalsByWorkspaceId = new Map(),
    onMoveTicket,
    onSelectTicket,
    onOpenSessionBubble,
    onOpenTicketWorkspace,
    onCreateStart,
    onColumnAction,
    selectedTicketId = null,
  } = props;
  const { t } = useTranslation("tickets");

  const COLUMN_ACTION_MAP: Record<TicketColumnAction, Omit<TicketBoardColumnAction, "id">> = {
    archive_all: { label: t("boardView.archiveAll"), icon: Archive },
  };

  const toColumnActions = (actions: TicketColumnAction[]): TicketBoardColumnAction[] =>
    actions.map((action) => ({ id: action, ...COLUMN_ACTION_MAP[action] }));

  const toBoardItem = (ticket: Ticket, ticketsById: Map<string, Ticket>): TicketBoardItem => {
    const latestAttempt = latestAttemptsByTicketId.get(ticket.id);
    const diffTotals = latestAttempt ? diffTotalsByWorkspaceId.get(latestAttempt.id) : undefined;
    const sessionId = latestAttempt?.sessionId || null;
    const workspaceShorthand = latestAttempt?.shorthand ?? "";

    return {
      id: ticket.id,
      cardProps: {
        ticketId: ticket.shorthand,
        parentPath: buildParentPath(ticket, ticketsById),
        title: ticket.title || t("boardView.emptyTicket"),
        badges: buildTicketBadges(ticket, displayProperties, badgeContext),
        sessionIndicatorLabel: latestAttempt?.shorthand,
        sessionIndicatorStatus: latestAttempt ? toSessionIndicatorStatus(latestAttempt.status) : undefined,
        diffAdditions: diffTotals?.additions,
        diffDeletions: diffTotals?.deletions,
        onSessionIndicatorClick: sessionId ? () => onOpenSessionBubble?.(sessionId) : undefined,
        onDiffBadgeClick:
          diffTotals && workspaceShorthand ? () => onOpenTicketWorkspace?.(ticket, workspaceShorthand) : undefined,
        onClick: undefined,
      },
    };
  };

  const ticketsById = new Map<string, Ticket>();
  for (const group of groups) {
    for (const ticket of group.tickets) {
      ticketsById.set(ticket.id, ticket);
    }
  }

  const columns: TicketBoardColumn[] = groups.map((group) => {
    const items = group.tickets.map((ticket) => {
      const item = toBoardItem(ticket, ticketsById);
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
