import { Flex, IconButton, Stack } from "@chakra-ui/react";
import { PanelRightOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Project } from "@/features/project/types";
import type { ApiTicketFilesResponse } from "@/features/ticket-list/data/api";
import type { Ticket } from "@/features/ticket-list/types";
import { TicketFileList } from "./ticket-file-list";
import { TicketProperties } from "./ticket-properties";
import { TicketSubTicketList } from "./ticket-sub-ticket-list";

interface TicketDetailSidebarProps {
  ticket: Ticket;
  project: Project | null | undefined;
  allTickets: Ticket[];
  ticketFiles: ApiTicketFilesResponse | undefined;
  selectedFileId: string;
  isOpen: boolean;
  isUpdatingTags: boolean;
  onToggle: () => void;
  onSelectFile: (fileId: string) => void;
  onSelectTicket: (ticketId: string) => void;
  onTagIdsChange: (tagIds: string[]) => void;
}

export const TicketDetailSidebar = (props: TicketDetailSidebarProps) => {
  const {
    ticket,
    project,
    allTickets,
    ticketFiles,
    selectedFileId,
    isOpen,
    isUpdatingTags,
    onToggle,
    onSelectFile,
    onSelectTicket,
    onTagIdsChange,
  } = props;
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
    <Stack gap="xs" borderLeftWidth="1px" padding="sm" minW="320px" maxW="360px" overflow="auto">
      <TicketProperties
        ticket={ticket}
        project={project}
        tickets={allTickets}
        onSelectTicket={onSelectTicket}
        onTagIdsChange={onTagIdsChange}
        isUpdatingTags={isUpdatingTags}
      />

      <TicketFileList data={ticketFiles} selectedFileId={selectedFileId} onSelect={onSelectFile} />

      <TicketSubTicketList
        subTickets={ticket.subTickets ?? []}
        knownTicketIds={allTickets.map((projectTicket) => projectTicket.id)}
        onSelectTicket={onSelectTicket}
      />
    </Stack>
  );
};
