import { Flex, IconButton } from "@chakra-ui/react";
import type { BreadcrumbItem } from "@pstdio/ui";
import { Breadcrumb, HorizontalMenuStack } from "@pstdio/ui";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ActionDescriptor } from "@/features/plugin-actions/api";
import { TicketActionMenu } from "./ticket-action-menu";
import { TicketAttemptButton } from "./ticket-attempt-button";

interface TicketHeaderProps {
  breadcrumbItems: BreadcrumbItem[];
  attemptCount: number;
  additions: number;
  deletions: number;
  isRunningAttempt: boolean;
  isArchived: boolean;
  canDeleteTicket: boolean;
  pluginActions?: ActionDescriptor[];
  onNavigateBack: () => void;
  onRunAttempt: () => Promise<boolean> | boolean;
  onViewWorkspace: () => void;
  onCreateSubTicket: () => void;
  onBreakIntoSubTickets: () => void;
  onRefineTicket: () => void;
  onArchiveTicket: () => void;
  onDeleteTicket: () => void | Promise<void>;
  onPluginAction?: (actionKey: string) => void;
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
    pluginActions,
    onNavigateBack,
    onRunAttempt,
    onViewWorkspace,
    onCreateSubTicket,
    onBreakIntoSubTickets,
    onRefineTicket,
    onArchiveTicket,
    onDeleteTicket,
    onPluginAction,
  } = props;
  const { t } = useTranslation("tickets");

  return (
    <HorizontalMenuStack>
      <Flex align="center" gap="sm">
        <IconButton aria-label={t("ticketDetail.backToTickets")} variant="ghost" size="sm" onClick={onNavigateBack}>
          <ArrowLeft />
        </IconButton>

        <Breadcrumb separator="/" separatorGap="xs" items={breadcrumbItems} linkComponent={Link} />
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
          pluginActions={pluginActions}
          onCreateSubTicket={onCreateSubTicket}
          onBreakIntoSubTickets={onBreakIntoSubTickets}
          onRefineTicket={onRefineTicket}
          onArchiveTicket={onArchiveTicket}
          onDeleteTicket={onDeleteTicket}
          onPluginAction={onPluginAction}
        />
      </Flex>
    </HorizontalMenuStack>
  );
};
