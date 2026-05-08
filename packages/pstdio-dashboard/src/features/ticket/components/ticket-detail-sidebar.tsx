import { Flex, IconButton, Stack } from "@chakra-ui/react";
import { PanelRightOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Project } from "@/features/project/types";
import type { Ticket } from "@/features/ticket-list/types";
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
  onTagIdsChange: (tagIds: string[]) => void;
}

export const TicketDetailSidebar = (props: TicketDetailSidebarProps) => {
  const { ticket, project, allTickets, isOpen, isUpdatingTags, onToggle, onSelectTicket, onTagIdsChange } = props;
  const { t } = useTranslation("tickets");

  if (!isOpen) {
    return (
      <Flex borderLeftWidth="1px" padding="sm" minW="52px" justify="center" align="flex-start">
        <IconButton aria-label={t("ticketDetail.openDetailsPanel")} variant="ghost" size="sm" onClick={onToggle}>
          <PanelRightOpen />
        </IconButton>
      </Flex>
    );
  }

  return (
    <Stack gap="xs" minW="320px" maxW="360px" overflow="auto">
      <TicketProperties
        ticket={ticket}
        project={project}
        tickets={allTickets}
        onSelectTicket={onSelectTicket}
        onTagIdsChange={onTagIdsChange}
        isUpdatingTags={isUpdatingTags}
      />
      <TicketSubTicketList
        subTickets={ticket.subTickets ?? []}
        knownTicketIds={allTickets.map((projectTicket) => projectTicket.id)}
        onSelectTicket={onSelectTicket}
      />
    </Stack>
  );
};
