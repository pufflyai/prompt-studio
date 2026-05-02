import { Box } from "@chakra-ui/react";
import { useState } from "react";

import { TicketsWorkspace } from "../../tickets/tickets-workspace";
import type { WorkspaceTicket } from "../../tickets/types";
import { mockTagDefinitions, mockTickets } from "../mock-data";

export const TICKETS_STORAGE_KEY = "app-shell-tickets";

interface TicketsPageProps {
  onSelectTicket: (ticket: WorkspaceTicket) => void;
}

const knownColumnKeys = ["todo", "in_progress", "done"];

export const TicketsPage = (props: TicketsPageProps) => {
  const { onSelectTicket } = props;
  const [tickets, setTickets] = useState(mockTickets);

  const handleMoveTicket = (ticketId: string, targetColumn: string) => {
    setTickets((current) =>
      current.map((ticket) => (ticket.id === ticketId ? { ...ticket, status: targetColumn } : ticket)),
    );
  };

  return (
    <Box flex="1" minH="0" overflow="hidden">
      <TicketsWorkspace
        tickets={tickets}
        storageKey={TICKETS_STORAGE_KEY}
        tagDefinitions={mockTagDefinitions}
        knownColumnKeys={knownColumnKeys}
        hideToolbar
        onTicketClick={onSelectTicket}
        onMoveTicket={handleMoveTicket}
        getBoardColumnConfig={(groupKey) => ({
          color: groupKey === "done" ? "green" : groupKey === "in_progress" ? "blue" : "gray",
          canDragIn: true,
          canDragOut: true,
        })}
      />
    </Box>
  );
};
