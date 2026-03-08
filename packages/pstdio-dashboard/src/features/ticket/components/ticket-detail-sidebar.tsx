import { Button, Flex, IconButton, Stack } from "@chakra-ui/react";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import type { Project } from "@/features/project/types";
import type { Ticket } from "@/features/ticket-list/types";
import { TicketFileList } from "./ticket-file-list";
import { TicketProperties } from "./ticket-properties";
import { TicketSubTicketList } from "./ticket-sub-ticket-list";

interface TicketDetailSidebarProps {
  ticket: Ticket;
  project: Project | null | undefined;
  allTickets: Ticket[];
  isOpen: boolean;
  isUpdatingTags: boolean;
  onToggle: () => void;
  onSelectTicket: (ticketId: string) => void;
  onComplexityChange: (complexity: Ticket["complexity"]) => void;
  onTagIdsChange: (tagIds: string[]) => void;
  onBreakIntoSubTickets: () => void;
}

export const TicketDetailSidebar = (props: TicketDetailSidebarProps) => {
  const {
    ticket,
    project,
    allTickets,
    isOpen,
    isUpdatingTags,
    onToggle,
    onSelectTicket,
    onComplexityChange,
    onTagIdsChange,
    onBreakIntoSubTickets,
  } = props;

  if (!isOpen) {
    return (
      <Flex borderLeftWidth="1px" padding="sm" minW="52px" justify="center" align="flex-start">
        <IconButton aria-label="Open details panel" variant="ghost" size="sm" onClick={onToggle}>
          <PanelRightOpen />
        </IconButton>
      </Flex>
    );
  }

  return (
    <Stack gap="xs" borderLeftWidth="1px" padding="sm" minW="320px" maxW="360px" overflow="auto">
      <Flex justify="flex-end">
        <IconButton aria-label="Collapse details panel" variant="ghost" size="sm" onClick={onToggle}>
          <PanelRightClose />
        </IconButton>
      </Flex>

      <TicketProperties
        ticket={ticket}
        project={project}
        tickets={allTickets}
        onSelectTicket={onSelectTicket}
        onComplexityChange={onComplexityChange}
        onTagIdsChange={onTagIdsChange}
        isUpdatingTags={isUpdatingTags}
      />

      <Button size="sm" variant="subtle" alignSelf="flex-start" onClick={onBreakIntoSubTickets}>
        Break into sub-tickets
      </Button>

      <TicketSubTicketList
        subTickets={ticket.subTickets ?? []}
        knownTicketIds={allTickets.map((projectTicket) => projectTicket.id)}
        onSelectTicket={onSelectTicket}
      />

      <TicketFileList ticketId={ticket.id} />
    </Stack>
  );
};
