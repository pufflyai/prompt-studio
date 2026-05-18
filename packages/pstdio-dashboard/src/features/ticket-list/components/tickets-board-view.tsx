import {
  DataRendererBoard,
  type DataRendererBoardColumn,
  type DataRendererBoardColumnAction,
  type ResourceContextAction,
  type WorkspaceBadgeProps,
} from "@pstdio/ui";
import { Archive } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { SyncedRow } from "@/features/sync/collections";
import type { Ticket, TicketAttempt, TicketColumnAction, TicketStatus } from "@/features/ticket-list/types";
import type { AttemptStatusMapEntry } from "@/features/workspaces/hooks/attempt-status-map";
import { getAttemptLabelFromWorkspaceShorthand } from "@/features/workspaces/utils/workspace-shorthand";

import type { BadgeContext, DisplayProperty, TicketGroup } from "../types";
import { toSessionIndicatorStatus } from "../utils/ticket-attempts";
import { buildTicketBadges } from "../utils/ticket-badges";
import { buildParentPath } from "../utils/ticket-parent-path";

const buildWorkspaceBadge = (input: {
  ticket: Ticket;
  latestAttempt: TicketAttempt | undefined;
  diffTotals: { additions: number; deletions: number } | undefined;
  attemptStatusMap: Map<string, AttemptStatusMapEntry>;
  sessionId: string | null;
  onOpenSessionBubble?: (sessionId: string | null) => void;
  onOpenTicketWorkspace?: (ticket: Ticket, workspaceShorthand: string) => void;
}): WorkspaceBadgeProps | undefined => {
  const { ticket, latestAttempt, diffTotals, attemptStatusMap, sessionId, onOpenSessionBubble, onOpenTicketWorkspace } =
    input;

  if (!latestAttempt) {
    return undefined;
  }

  const attemptStatus = latestAttempt.attemptStatusId ? attemptStatusMap.get(latestAttempt.attemptStatusId) : undefined;
  const shorthand =
    (ticket.attempts?.length ?? 0) > 1 ? getAttemptLabelFromWorkspaceShorthand(latestAttempt.shorthand) : undefined;

  return {
    workspaceType: latestAttempt.worktreePath ? "worktree" : "current_branch",
    shorthand,
    attemptStatus,
    sessionStatus: toSessionIndicatorStatus(latestAttempt.sessionStatus),
    diffAdditions: diffTotals?.additions,
    diffDeletions: diffTotals?.deletions,
    onSessionIndicatorClick: sessionId ? () => onOpenSessionBubble?.(sessionId) : undefined,
    onClick: latestAttempt.shorthand ? () => onOpenTicketWorkspace?.(ticket, latestAttempt.shorthand) : undefined,
  };
};

interface TicketsBoardViewProps {
  groups: TicketGroup[];
  displayProperties: DisplayProperty[];
  badgeContext: BadgeContext;
  latestAttemptsByTicketId?: Map<string, TicketAttempt>;
  diffTotalsByWorkspaceId?: Map<string, { additions: number; deletions: number }>;
  attemptStatusMap?: Map<string, AttemptStatusMapEntry>;
  sessionsByWorkspace?: Map<string, SyncedRow>;
  onMoveTicket?: (ticketId: string, nextStatus: TicketStatus) => void;
  onSelectTicket?: (ticket: Ticket) => void;
  onOpenSessionBubble?: (sessionId: string | null) => void;
  onOpenTicketWorkspace?: (ticket: Ticket, workspaceShorthand: string) => void;
  onCreateStart?: (status: TicketStatus) => void;
  onColumnAction?: (status: TicketStatus, action: TicketColumnAction) => Promise<void> | void;
  selectedTicketId?: string | null;
  resolveContextMenuActions?: (ticket: Ticket) => ResourceContextAction[];
}

export const TicketsBoardView = (props: TicketsBoardViewProps) => {
  const {
    groups,
    displayProperties,
    badgeContext,
    latestAttemptsByTicketId = new Map(),
    diffTotalsByWorkspaceId = new Map(),
    attemptStatusMap = new Map(),
    sessionsByWorkspace = new Map(),
    onMoveTicket,
    onSelectTicket,
    onOpenSessionBubble,
    onOpenTicketWorkspace,
    onCreateStart,
    onColumnAction,
    selectedTicketId = null,
    resolveContextMenuActions,
  } = props;
  const { t } = useTranslation("tickets");

  const COLUMN_ACTION_MAP: Record<TicketColumnAction, Omit<DataRendererBoardColumnAction, "id">> = {
    archive_all: { label: t("boardView.archiveAll"), icon: Archive },
  };

  const toColumnActions = (actions: TicketColumnAction[]): DataRendererBoardColumnAction[] =>
    actions.map((action) => ({ id: action, ...COLUMN_ACTION_MAP[action] }));

  const toBoardItem = (ticket: Ticket, ticketsById: Map<string, Ticket>) => {
    const latestAttempt = latestAttemptsByTicketId.get(ticket.id);
    const diffTotals = latestAttempt ? diffTotalsByWorkspaceId.get(latestAttempt.id) : undefined;
    const sessionId = latestAttempt ? ((sessionsByWorkspace.get(latestAttempt.id)?.id as string) ?? null) : null;

    return {
      id: ticket.id,
      contextMenuActions: resolveContextMenuActions?.(ticket),
      cardProps: {
        ticketId: ticket.shorthand,
        parentPath: buildParentPath(ticket, ticketsById),
        title: ticket.title || t("boardView.emptyTicket"),
        badges: buildTicketBadges(ticket, displayProperties, badgeContext),
        workspaceBadge: buildWorkspaceBadge({
          ticket,
          latestAttempt,
          diffTotals,
          attemptStatusMap,
          sessionId,
          onOpenSessionBubble,
          onOpenTicketWorkspace,
        }),
        onClick: () => onSelectTicket?.(ticket),
      },
    };
  };

  const ticketsById = new Map<string, Ticket>();
  for (const group of groups) {
    for (const ticket of group.tickets) {
      ticketsById.set(ticket.id, ticket);
    }
  }

  const columns: DataRendererBoardColumn[] = groups.map((group) => {
    const items = group.tickets.map((ticket) => toBoardItem(ticket, ticketsById));

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
    <DataRendererBoard
      columns={columns}
      selectedItemId={selectedTicketId}
      onMoveItem={handleMoveItem}
      onCreateStart={onCreateStart}
      onColumnAction={handleColumnAction}
    />
  );
};
