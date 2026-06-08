import { Box, Stack } from "@chakra-ui/react";
import { DeleteConfirmationModal, PanelLayout } from "@pstdio/ui";
import { useNavigate, useParams } from "@tanstack/react-router";
import { Archive, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ProjectSidebar } from "@/features/project/components/project-sidebar";
import { useProject } from "@/features/project/hooks/use-project";
import { openTicketSessionBubble } from "@/features/ticket/utils/open-ticket-session-bubble";
import { useCreateProjectTicket } from "@/features/ticket-list/hooks/use-create-project-ticket";
import {
  useDeleteProjectTicket,
  useProjectTickets,
  useUpdateProjectTicket,
  useUpdateProjectTicketStatus,
} from "@/features/ticket-list/hooks/use-project-tickets";
import { useTicketAttemptDiffs } from "@/features/ticket-list/hooks/use-ticket-attempt-diffs";
import type { Ticket, TicketColumnAction, TicketStatus } from "@/features/ticket-list/types";
import { useAttemptStatusMap } from "@/features/workspaces/hooks/use-attempt-status-map";
import type { HeaderActionItem } from "@/shared/extensions/components/header-actions";
import { headerActionsToResourceContextActions } from "@/shared/extensions/context-menu-actions";
import { useExtensionResourceContextMenuActions } from "@/shared/extensions/hooks/use-extension-resource-context-menu-actions";
import { buildTicketExtensionResource } from "@/shared/extensions/resource-context";
import { useDeferredPageMount } from "@/shared/performance/use-deferred-page-mount";
import { useProjectSettingsStore, useProjectSettingsStoreApi } from "@/shared/stores/project-settings";

import { CreateTicketModal, type CreateTicketModalPayload } from "../components/create-ticket-modal";
import { TicketsBoardView } from "../components/tickets-board-view";
import { TicketsHeader } from "../components/tickets-header";
import { TicketsListView } from "../components/tickets-list-view";
import { uploadTicketFile } from "../data/api/files";
import { shouldFetchTicketAttemptDiff } from "../hooks/use-ticket-attempt-diffs";
import { type BadgeContext, DEFAULT_DISPLAY_SETTINGS, type DisplaySettings } from "../types";
import { buildLatestAttemptsByTicketId } from "../utils/ticket-attempts";
import { groupTickets, orderTickets } from "../utils/ticket-grouping";
import { getVisibleTickets } from "../utils/ticket-visibility";
import { navigateToTicketDetails, navigateToTicketWorkspace } from "./ticket-navigation";
import { useCreateTicketShortcut } from "./use-create-ticket-shortcut";

const TICKET_CONTEXT_MENU_EXTENSION_SLOTS = ["ticket.headerPrimary", "ticket.headerOverflow"];

const buildTicketOverflowActions = (input: {
  ticketId: string;
  archived: boolean;
  projectId: string | undefined;
  updateTicket: ReturnType<typeof useUpdateProjectTicket>;
  deleteTicket: ReturnType<typeof useDeleteProjectTicket>;
  onDeleteOpen: () => void;
  t: (key: string) => string;
}) => {
  const { ticketId, archived, projectId, updateTicket, deleteTicket, onDeleteOpen, t } = input;

  return [
    {
      key: "archive-ticket",
      label: t(
        archived ? "projects:ticketPanel.options.unarchiveTicket" : "projects:ticketPanel.options.archiveTicket",
      ),
      kind: "default",
      icon: Archive,
      isDisabled: updateTicket.isPending,
      onClick: () => updateTicket.mutate({ ticketId, archived: !archived }),
    },
    {
      key: "delete-ticket",
      label: t("projects:ticketPanel.options.deleteTicket"),
      kind: "default",
      icon: Trash2,
      isDisabled: !projectId || deleteTicket.isPending,
      onClick: onDeleteOpen,
    },
  ] satisfies HeaderActionItem[];
};

const buildTicketContextMenuActions = (input: {
  ticket: Ticket;
  projectId: string | undefined;
  extensionActions: ReturnType<typeof useExtensionResourceContextMenuActions>;
  updateTicket: ReturnType<typeof useUpdateProjectTicket>;
  deleteTicket: ReturnType<typeof useDeleteProjectTicket>;
  onDeleteOpen: (ticketId: string) => void;
  t: (key: string) => string;
}) => {
  const { ticket, projectId, extensionActions, updateTicket, deleteTicket, onDeleteOpen, t } = input;

  return [
    ...extensionActions.resolveActions(buildTicketExtensionResource({ projectId, ticket })),
    ...headerActionsToResourceContextActions({
      actions: buildTicketOverflowActions({
        ticketId: ticket.id,
        archived: Boolean(ticket.archived),
        projectId,
        updateTicket,
        deleteTicket,
        onDeleteOpen: () => onDeleteOpen(ticket.id),
        t,
      }),
    }),
  ];
};

export const TicketsPanel = () => {
  const { projectId } = useParams({ strict: false });
  const { data: project } = useProject(projectId);
  const { data: tickets, sessionsByWorkspace } = useProjectTickets(projectId);
  const attemptStatusMap = useAttemptStatusMap(projectId);
  const updateTicketStatus = useUpdateProjectTicketStatus(projectId);
  const updateTicket = useUpdateProjectTicket(projectId);
  const deleteTicket = useDeleteProjectTicket(projectId);
  const createTicket = useCreateProjectTicket(projectId);
  const navigate = useNavigate();
  const projectSettingsStore = useProjectSettingsStoreApi();
  const setSessionModalState = useProjectSettingsStore((s) => s.setSessionModalState);
  const setSelectedSessionId = useProjectSettingsStore((s) => s.setSelectedSessionId);
  const createTicketRequestKey = useProjectSettingsStore((s) => s.createTicketRequestKey);
  const lastHandledCreateTicketRequestKey = useProjectSettingsStore((s) => s.lastHandledCreateTicketRequestKey);
  const acknowledgeCreateTicketRequest = useProjectSettingsStore((s) => s.acknowledgeCreateTicketRequest);
  const { t } = useTranslation(["tickets", "projects"]);
  const [settings] = useState<DisplaySettings>(DEFAULT_DISPLAY_SETTINGS);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createModalStatus, setCreateModalStatus] = useState<TicketStatus | null>(null);
  const [deleteTicketId, setDeleteTicketId] = useState<string | null>(null);
  const boardMounted = useDeferredPageMount("tickets", projectId);
  const statusOptions = project?.ticketStatusOptions ?? [];
  const allTickets = getVisibleTickets(tickets ?? []);
  const latestAttemptsByTicketId = buildLatestAttemptsByTicketId(allTickets);
  const attemptDiffInputs = [...latestAttemptsByTicketId.values()].map((attempt) => ({
    workspaceId: attempt.id,
    shouldFetch: shouldFetchTicketAttemptDiff(attempt),
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

  useCreateTicketShortcut({
    projectId,
    createTicketRequestKey,
    lastHandledCreateTicketRequestKey,
    firstCreatableStatus,
    setCreateModalStatus,
    setCreateModalOpen,
    acknowledgeCreateTicketRequest,
  });

  const closeCreateModal = () => {
    setCreateModalOpen(false);
    setCreateModalStatus(null);
  };

  const handleOpenSessionBubble = (sessionId: string | null) => {
    return openTicketSessionBubble({
      sessionId,
      sessionModalState: projectSettingsStore.getState().sessionModalState,
      setSessionModalState,
      setSelectedSessionId,
    });
  };

  const ticketContextMenuActions = useExtensionResourceContextMenuActions({
    slotId: TICKET_CONTEXT_MENU_EXTENSION_SLOTS,
  });

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

      if (payload.files.length > 0 && projectId) {
        try {
          await Promise.all(payload.files.map((file) => uploadTicketFile(projectId, createdTicket.id, file)));
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

  const buildContextMenuActions = (ticket: Ticket) =>
    buildTicketContextMenuActions({
      ticket,
      projectId,
      extensionActions: ticketContextMenuActions,
      updateTicket,
      deleteTicket,
      onDeleteOpen: setDeleteTicketId,
      t,
    });

  return (
    <PanelLayout sidebar={<ProjectSidebar />}>
      <Stack gap="0" height="100%" flex="1" minW="0">
        <TicketsHeader />

        <Stack flex="1" minH="0" minW="0">
          {!boardMounted ? (
            <Box flex="1" />
          ) : settings.viewMode === "board" ? (
            <TicketsBoardView
              groups={groups}
              displayProperties={settings.displayProperties}
              badgeContext={badgeContext}
              latestAttemptsByTicketId={latestAttemptsByTicketId}
              diffTotalsByWorkspaceId={diffTotalsByWorkspaceId}
              attemptStatusMap={attemptStatusMap}
              sessionsByWorkspace={sessionsByWorkspace}
              onMoveTicket={handleMoveTicket}
              onSelectTicket={(ticket) => projectId && navigateToTicketDetails(navigate, projectId, ticket.shorthand)}
              onOpenSessionBubble={handleOpenSessionBubble}
              onOpenTicketWorkspace={(ticket, workspaceShorthand) =>
                projectId &&
                workspaceShorthand &&
                navigateToTicketWorkspace(navigate, projectId, ticket.shorthand, workspaceShorthand)
              }
              resolveContextMenuActions={buildContextMenuActions}
              onCreateStart={(status) => openCreateModal(status)}
              onColumnAction={handleColumnAction}
            />
          ) : (
            <TicketsListView
              groups={groups}
              displayProperties={settings.displayProperties}
              badgeContext={badgeContext}
              onMoveTicket={handleMoveTicket}
              onSelectTicket={(ticket) => projectId && navigateToTicketDetails(navigate, projectId, ticket.shorthand)}
              resolveContextMenuActions={buildContextMenuActions}
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

        {ticketContextMenuActions.paramsDialog}

        <DeleteConfirmationModal
          open={Boolean(deleteTicketId)}
          onClose={() => setDeleteTicketId(null)}
          onDelete={async () => {
            if (!deleteTicketId) return;
            await deleteTicket.mutateAsync({ ticketId: deleteTicketId });
            setDeleteTicketId(null);
          }}
          headline={t("projects:ticketPanel.deleteConfirmation.ticket.headline")}
          notificationText={t("projects:ticketPanel.deleteConfirmation.ticket.notification")}
          buttonText={t("projects:ticketPanel.options.deleteTicket")}
        />
      </Stack>
    </PanelLayout>
  );
};
