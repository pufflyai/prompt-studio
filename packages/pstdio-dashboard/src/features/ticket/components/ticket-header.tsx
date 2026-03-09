import { Flex, IconButton } from "@chakra-ui/react";
import { Breadcrumb, HorizontalMenuStack } from "@pstdio/ui";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TicketActionMenu } from "./ticket-action-menu";
import { TicketAttemptButton } from "./ticket-attempt-button";

interface TicketHeaderProps {
  breadcrumbItems: Array<{ title: string; onClick: () => void }>;
  attemptCount: number;
  additions: number;
  deletions: number;
  isRunningAttempt: boolean;
  isArchived: boolean;
  canDeleteTicket: boolean;
  onNavigateBack: () => void;
  onRunAttempt: () => Promise<boolean> | boolean;
  onViewWorkspace: () => void;
  onCreateSubTicket: () => void;
  onBreakIntoSubTickets: () => void;
  onRefineTicket: () => void;
  onArchiveTicket: () => void;
  onDeleteTicket: () => void | Promise<void>;
}

export const TicketHeader = (props: TicketHeaderProps) => {
  const {
    breadcrumbItems,
    attemptCount,
    additions,
    deletions,
    isRunningAttempt,
    isArchived,
    canDeleteTicket,
    onNavigateBack,
    onRunAttempt,
    onViewWorkspace,
    onCreateSubTicket,
    onBreakIntoSubTickets,
    onRefineTicket,
    onArchiveTicket,
    onDeleteTicket,
  } = props;
  const { t } = useTranslation("tickets");

  return (
    <HorizontalMenuStack>
      <Flex align="center" gap="sm">
        <IconButton aria-label={t("ticketDetail.backToTickets")} variant="ghost" size="sm" onClick={onNavigateBack}>
          <ArrowLeft />
        </IconButton>

        <Breadcrumb separator="/" separatorGap="xs" items={breadcrumbItems} />
      </Flex>

      <Flex align="center" gap="xs">
        <TicketAttemptButton
          attemptCount={attemptCount}
          additions={additions}
          deletions={deletions}
          isRunning={isRunningAttempt}
          onRunAttempt={onRunAttempt}
          onViewWorkspace={onViewWorkspace}
        />

        <TicketActionMenu
          isArchived={isArchived}
          canDeleteTicket={canDeleteTicket}
          onCreateSubTicket={onCreateSubTicket}
          onBreakIntoSubTickets={onBreakIntoSubTickets}
          onRefineTicket={onRefineTicket}
          onArchiveTicket={onArchiveTicket}
          onDeleteTicket={onDeleteTicket}
        />
      </Flex>
    </HorizontalMenuStack>
  );
};
