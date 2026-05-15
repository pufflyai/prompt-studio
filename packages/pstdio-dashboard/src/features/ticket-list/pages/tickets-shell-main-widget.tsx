import { Box, Stack } from "@chakra-ui/react";
import type { ComponentProps } from "react";
import { TicketsBoardView } from "../components/tickets-board-view";
import { TicketsListView } from "../components/tickets-list-view";
import type { DisplaySettings } from "../types";

type TicketsBoardViewProps = ComponentProps<typeof TicketsBoardView>;

interface TicketsShellMainWidgetProps extends TicketsBoardViewProps {
  boardMounted: boolean;
  viewMode: DisplaySettings["viewMode"];
}

export const TicketsShellMainWidget = (props: TicketsShellMainWidgetProps) => {
  const {
    badgeContext,
    boardMounted,
    diffTotalsByWorkspaceId,
    displayProperties,
    groups,
    latestAttemptsByTicketId,
    attemptStatusMap,
    onColumnAction,
    onCreateStart,
    onMoveTicket,
    onOpenSessionBubble,
    onOpenTicketWorkspace,
    onSelectTicket,
    resolveContextMenuActions,
    sessionsByWorkspace,
    viewMode,
  } = props;

  return (
    <Stack gap="0" h="full" flex="1" minH="0" minW="0" overflow="hidden">
      {!boardMounted ? (
        <Box flex="1" />
      ) : viewMode === "board" ? (
        <TicketsBoardView
          groups={groups}
          displayProperties={displayProperties}
          badgeContext={badgeContext}
          latestAttemptsByTicketId={latestAttemptsByTicketId}
          diffTotalsByWorkspaceId={diffTotalsByWorkspaceId}
          attemptStatusMap={attemptStatusMap}
          sessionsByWorkspace={sessionsByWorkspace}
          onMoveTicket={onMoveTicket}
          onSelectTicket={onSelectTicket}
          onOpenSessionBubble={onOpenSessionBubble}
          onOpenTicketWorkspace={onOpenTicketWorkspace}
          resolveContextMenuActions={resolveContextMenuActions}
          onCreateStart={onCreateStart}
          onColumnAction={onColumnAction}
        />
      ) : (
        <TicketsListView
          groups={groups}
          displayProperties={displayProperties}
          badgeContext={badgeContext}
          onSelectTicket={onSelectTicket}
          resolveContextMenuActions={resolveContextMenuActions}
        />
      )}
    </Stack>
  );
};
