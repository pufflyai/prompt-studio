import { Stack, Text } from "@chakra-ui/react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useProject, useProjectTemplateAssets } from "@/features/project/hooks/use-project";
import { useProjectSettingsStore } from "@/features/project-settings/store";
import { openTicketSessionBubble } from "@/features/ticket/utils/open-ticket-session-bubble";
import { useCreateProjectTicket } from "@/features/ticket-list/hooks/use-create-project-ticket";
import {
  useProjectTickets,
  useUpdateProjectTicket,
  useUpdateProjectTicketStatus,
} from "@/features/ticket-list/hooks/use-project-tickets";
import { useTicketAttemptDiffs } from "@/features/ticket-list/hooks/use-ticket-attempt-diffs";
import type { TicketColumnAction, TicketStatus } from "@/features/ticket-list/types";

import { CreateTicketModal, type CreateTicketModalPayload } from "../components/create-ticket-modal";
import { TicketsBoardView } from "../components/tickets-board-view";
import { TicketsHeader } from "../components/tickets-header";
import { TicketsListView } from "../components/tickets-list-view";
import { type BadgeContext, DEFAULT_DISPLAY_SETTINGS, type DisplaySettings } from "../types";
import { buildLatestAttemptsByTicketId } from "../utils/ticket-attempts";
import { groupTickets, orderTickets } from "../utils/ticket-grouping";
import { getVisibleTickets } from "../utils/ticket-visibility";

export const TicketsPanel = () => {
  const { projectId } = useParams({ strict: false });
  const { data: project, isLoading: isProjectLoading } = useProject(projectId);
  const { data: tickets, isLoading: isTicketsLoading } = useProjectTickets(projectId);
  const updateTicketStatus = useUpdateProjectTicketStatus(projectId);
  const updateTicket = useUpdateProjectTicket(projectId);
  const createTicket = useCreateProjectTicket(projectId);
  const { data: templateAssets } = useProjectTemplateAssets(projectId);
  const navigate = useNavigate();

  const setSessionModalState = useProjectSettingsStore((s) => s.setSessionModalState);
  const setSelectedSessionId = useProjectSettingsStore((s) => s.setSelectedSessionId);
  const { t } = useTranslation("tickets");
  const [settings] = useState<DisplaySettings>(DEFAULT_DISPLAY_SETTINGS);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createModalStatus, setCreateModalStatus] = useState<TicketStatus | null>(null);

  const isLoading = isProjectLoading || isTicketsLoading;
  const statusOptions = project?.ticketStatusOptions ?? [];
  const allTickets = getVisibleTickets(tickets ?? []);
  const latestAttemptsByTicketId = buildLatestAttemptsByTicketId(allTickets);
  const latestWorkspaceIds = [...new Set([...latestAttemptsByTicketId.values()].map((attempt) => attempt.id))];
  const { diffTotalsByWorkspaceId } = useTicketAttemptDiffs(latestWorkspaceIds);

  const groups = groupTickets(allTickets, settings.grouping, statusOptions).map((group) => ({
    ...group,
    tickets: orderTickets(group.tickets, settings.ordering),
  }));

  const tags = project?.ticketTags ?? [];
  const badgeContext: BadgeContext = {
    statusOptions: statusOptions.map((s) => ({ name: s.name, color: s.color })),
    tags,
    tagMap: new Map(tags.map((t) => [t.id, t])),
    ticketShorthandById: Object.fromEntries(allTickets.map((ticket) => [ticket.id, ticket.shorthand])),
  };

  const templates = (templateAssets ?? [])
    .filter((asset) => asset.templateType === "ticket")
    .map((asset) => ({ id: asset.id, name: asset.name }));

  const firstCreatableStatus = statusOptions.find((s) => s.canCreate)?.name ?? null;

  const openCreateModal = (status?: TicketStatus) => {
    setCreateModalStatus(status ?? firstCreatableStatus);
    setCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    setCreateModalOpen(false);
    setCreateModalStatus(null);
  };

  const handleMoveTicket = (ticketId: string, status: TicketStatus) => {
    const targetStatus = statusOptions.find((col) => col.id === status || col.name === status);
    const resolvedStatus = targetStatus?.name ?? status;

    updateTicketStatus.mutateAsync({ ticketId, status: resolvedStatus }).catch((error) => {
      console.error("[move ticket]", error);
    });
  };

  const handleCreateTicket = async (payload: CreateTicketModalPayload) => {
    if (createTicket.isPending) return;

    try {
      await createTicket.mutateAsync({
        title: payload.content,
        content: payload.content,
        complexity: payload.complexity,
        status: payload.status,
        parentId: payload.parentId,
      });

      closeCreateModal();
    } catch (error) {
      console.error("[create ticket]", error);
    }
  };

  const handleColumnAction = async (status: TicketStatus, action: TicketColumnAction) => {
    if (action !== "archive_all") return;

    const sourceStatus = statusOptions.find((col) => col.id === status || col.name === status);

    if (!sourceStatus) {
      console.error("[archive all] Ticket status not found.");
      return;
    }

    const ticketsInColumn = allTickets
      .filter((t) => t.status === sourceStatus.name)
      .sort((a, b) => a.shorthand.localeCompare(b.shorthand) || a.id.localeCompare(b.id));

    const results = await Promise.allSettled(
      ticketsInColumn.map((t) => updateTicket.mutateAsync({ ticketId: t.id, archived: true })),
    );

    const firstFailure = results.find((r) => r.status === "rejected");

    if (firstFailure && firstFailure.status === "rejected") {
      console.error("[archive all]", firstFailure.reason);
    }
  };

  const navigateToTicket = (shorthand: string) => {
    navigate({
      to: "/projects/$projectId/tickets/$ticketShorthand",
      params: { projectId: projectId!, ticketShorthand: shorthand },
    });
  };

  const handleOpenSessionBubble = (sessionId: string | null) => {
    openTicketSessionBubble({
      sessionId,
      setSessionModalState,
      setSelectedSessionId,
    });
  };

  const handleOpenTicketWorkspace = (ticketShorthand: string, workspaceShorthand: string) => {
    if (!projectId || !workspaceShorthand) return;

    navigate({
      to: "/projects/$projectId/tickets/$ticketShorthand/workspaces/$workspaceShorthand",
      params: { projectId, ticketShorthand, workspaceShorthand },
    });
  };

  if (isLoading) {
    return (
      <Stack gap="lg" height="100%" p="sm">
        <Text textStyle="paragraph/S/regular" color="fg.muted">
          {t("loading")}
        </Text>
      </Stack>
    );
  }

  return (
    <Stack gap="0" height="100%">
      <TicketsHeader />

      <Stack flex="1" minH="0">
        {settings.viewMode === "board" ? (
          <TicketsBoardView
            groups={groups}
            displayProperties={settings.displayProperties}
            badgeContext={badgeContext}
            latestAttemptsByTicketId={latestAttemptsByTicketId}
            diffTotalsByWorkspaceId={diffTotalsByWorkspaceId}
            onMoveTicket={handleMoveTicket}
            onSelectTicket={(ticket) => navigateToTicket(ticket.shorthand)}
            onOpenSessionBubble={handleOpenSessionBubble}
            onOpenTicketWorkspace={(ticket, workspaceShorthand) =>
              handleOpenTicketWorkspace(ticket.shorthand, workspaceShorthand)
            }
            onCreateStart={(status) => openCreateModal(status)}
            onColumnAction={handleColumnAction}
          />
        ) : (
          <TicketsListView
            groups={groups}
            displayProperties={settings.displayProperties}
            badgeContext={badgeContext}
            onSelectTicket={(ticket) => navigateToTicket(ticket.shorthand)}
          />
        )}
      </Stack>

      <CreateTicketModal
        open={createModalOpen}
        onClose={closeCreateModal}
        onSubmit={handleCreateTicket}
        isSubmitting={createTicket.isPending}
        targetStatus={createModalStatus}
        templates={templates}
      />
    </Stack>
  );
};
