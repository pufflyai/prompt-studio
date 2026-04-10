import { Stack, Text } from "@chakra-ui/react";
import { PanelLayout } from "@pstdio/ui";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ProjectSidebar } from "@/features/project/components/project-sidebar";
import { useProject } from "@/features/project/hooks/use-project";
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
import { uploadTicketFile } from "../data/api/files";
import { type BadgeContext, DEFAULT_DISPLAY_SETTINGS, type DisplaySettings } from "../types";
import { buildLatestAttemptsByTicketId, isSessionSettled } from "../utils/ticket-attempts";
import { groupTickets, orderTickets } from "../utils/ticket-grouping";
import { getVisibleTickets } from "../utils/ticket-visibility";

export const TicketsPanel = () => {
  const { projectId } = useParams({ strict: false });
  const { data: project, isLoading: isProjectLoading } = useProject(projectId);
  const { data: tickets, sessionsByWorkspace, isLoading: isTicketsLoading } = useProjectTickets(projectId);
  const updateTicketStatus = useUpdateProjectTicketStatus(projectId);
  const updateTicket = useUpdateProjectTicket(projectId);
  const createTicket = useCreateProjectTicket(projectId);
  const navigate = useNavigate();

  const sessionModalState = useProjectSettingsStore((s) => s.sessionModalState);
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
  const attemptDiffInputs = [...latestAttemptsByTicketId.values()].map((attempt) => ({
    workspaceId: attempt.id,
    settled: isSessionSettled(attempt.sessionStatus),
  }));
  const { diffTotalsByWorkspaceId } = useTicketAttemptDiffs(attemptDiffInputs);

  const groups = groupTickets(allTickets, settings.grouping, statusOptions).map((group) => ({
    ...group,
    tickets: orderTickets(group.tickets, settings.ordering),
  }));

  const tagDefs = project?.ticketTags ?? [];
  const tagEntries = tagDefs.flatMap((t) =>
    t.options.map((o) => ({ id: o.id, name: o.name, color: o.color, tagName: t.name })),
  );
  const badgeContext: BadgeContext = {
    statusOptions: statusOptions.map((s) => ({ name: s.name, color: s.color })),
    tags: tagEntries,
    tagMap: new Map(tagEntries.map((e) => [e.id, e])),
    ticketShorthandById: Object.fromEntries(allTickets.map((ticket) => [ticket.id, ticket.shorthand])),
  };

  const firstCreatableStatus = statusOptions.find((s) => s.canCreate)?.name ?? null;

  const openCreateModal = (status?: TicketStatus) => {
    setCreateModalStatus(status ?? firstCreatableStatus);
    setCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    setCreateModalOpen(false);
    setCreateModalStatus(null);
  };

  const handleOpenSessionBubble = (sessionId: string | null) => {
    return openTicketSessionBubble({
      sessionId,
      sessionModalState,
      setSessionModalState,
      setSelectedSessionId,
    });
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
      const createdTicket = await createTicket.mutateAsync({
        title: payload.content,
        content: payload.content,
        tagIds: payload.tagIds,
        status: payload.status,
        parentId: payload.parentId,
      });

      closeCreateModal();

      if (payload.files.length > 0) {
        try {
          await Promise.all(payload.files.map((file) => uploadTicketFile(createdTicket.id, file)));
        } catch (error) {
          console.error("[create ticket file upload]", error);
        }
      }
    } catch (error) {
      console.error("[create ticket]", error);
      throw error;
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

  const handleOpenTicketWorkspace = (ticketShorthand: string, workspaceShorthand: string) => {
    if (!projectId || !workspaceShorthand) return;

    navigate({
      to: "/projects/$projectId/tickets/$ticketShorthand/workspaces/$workspaceShorthand",
      params: { projectId, ticketShorthand, workspaceShorthand },
    });
  };

  if (isLoading) {
    return (
      <PanelLayout sidebar={<ProjectSidebar />}>
        <Stack gap="lg" height="100%" minW="0" p="sm">
          <Text textStyle="paragraph/S/regular" color="fg.muted">
            {t("loading")}
          </Text>
        </Stack>
      </PanelLayout>
    );
  }

  return (
    <PanelLayout sidebar={<ProjectSidebar />}>
      <Stack gap="0" height="100%" flex="1" minW="0">
        <TicketsHeader />

        <Stack flex="1" minH="0" minW="0">
          {settings.viewMode === "board" ? (
            <TicketsBoardView
              groups={groups}
              displayProperties={settings.displayProperties}
              badgeContext={badgeContext}
              latestAttemptsByTicketId={latestAttemptsByTicketId}
              diffTotalsByWorkspaceId={diffTotalsByWorkspaceId}
              sessionsByWorkspace={sessionsByWorkspace}
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
          key={projectId ?? "global"}
          open={createModalOpen}
          onClose={closeCreateModal}
          onSubmit={handleCreateTicket}
          isSubmitting={createTicket.isPending}
          targetStatus={createModalStatus}
          tags={tagDefs}
          projectName={project?.name}
          statusOptions={statusOptions}
        />
      </Stack>
    </PanelLayout>
  );
};
