import { useNavigate, useParams } from "@tanstack/react-router";
import { ShellWorkbench } from "pstdio-shell/react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActionParamsDialog } from "@/features/plugin-actions/components/action-params-dialog";
import { usePluginActionTrigger } from "@/features/plugin-actions/hooks/use-plugin-action-trigger";
import { buildResourceContextMenuActions } from "@/features/plugin-actions/hooks/use-resource-context-menu";
import { useProject } from "@/features/project/hooks/use-project";
import { buildTicketOverflowActions } from "@/features/ticket/pages/ticket-details-actions";
import { openTicketSessionBubble } from "@/features/ticket/utils/open-ticket-session-bubble";
import { useCreateProjectTicket } from "@/features/ticket-list/hooks/use-create-project-ticket";
import {
  useDeleteProjectTicket,
  useProjectTickets,
  useUpdateProjectTicket,
  useUpdateProjectTicketStatus,
} from "@/features/ticket-list/hooks/use-project-tickets";
import { useTicketAttemptDiffs } from "@/features/ticket-list/hooks/use-ticket-attempt-diffs";
import type { TicketColumnAction, TicketStatus } from "@/features/ticket-list/types";
import { useAttemptStatusMap } from "@/features/workspaces/hooks/use-attempt-status-map";
import { useOpenCommandPalette } from "@/shared/command-palette/open-command-palette-context";
import { useDeferredPageMount } from "@/shared/performance/use-deferred-page-mount";
import { createProjectRouteResource } from "@/shared/shell/dashboard-project-shell";
import { createDashboardTicketsShell } from "@/shared/shell/dashboard-tickets-shell";
import { useTicketsShellRenderers } from "@/shared/shell/tickets/use-tickets-shell-renderers";
import { useShell } from "@/shared/shell/use-shell";
import { useOpenShortcutHelp } from "@/shared/shortcut-help/open-shortcut-help-context";
import { useProjectSettingsStore, useProjectSettingsStoreApi } from "@/shared/stores/project-settings";

import type { CreateTicketModalPayload } from "../components/create-ticket-modal";
import { uploadTicketFile } from "../data/api/files";
import { shouldFetchTicketAttemptDiff } from "../hooks/use-ticket-attempt-diffs";
import { type BadgeContext, DEFAULT_DISPLAY_SETTINGS, type DisplaySettings } from "../types";
import { buildLatestAttemptsByTicketId } from "../utils/ticket-attempts";
import { groupTickets, orderTickets } from "../utils/ticket-grouping";
import { getVisibleTickets } from "../utils/ticket-visibility";
import { archiveTicketsInColumn } from "./tickets-panel-actions";
import { TicketsPanelDialogs } from "./tickets-panel-dialogs";
import { TicketsShellMainWidget } from "./tickets-shell-main-widget";
import { useCreateTicketShortcut } from "./use-create-ticket-shortcut";

const buildTicketListContextMenuActions = (input: {
  archived: boolean;
  deleteTicket: ReturnType<typeof useDeleteProjectTicket>;
  pluginActionTrigger: ReturnType<typeof usePluginActionTrigger>;
  projectId?: string;
  ticketId: string;
  t: (key: string) => string;
  updateTicket: ReturnType<typeof useUpdateProjectTicket>;
  onDeleteOpen: () => void;
}) => {
  const { archived, deleteTicket, pluginActionTrigger, projectId, ticketId, t, updateTicket, onDeleteOpen } = input;

  return buildResourceContextMenuActions({
    pluginActions: pluginActionTrigger.pluginActions,
    defaultOverflowActions: buildTicketOverflowActions({
      ticket: { id: ticketId, archived },
      projectId,
      updateTicket,
      deleteTicket,
      onDeleteOpen,
      t,
    }),
    pendingActionKeys: pluginActionTrigger.pendingActionKeys,
    onPluginAction: (actionKey) => void pluginActionTrigger.trigger(actionKey, ticketId),
  });
};

const createTicketFromPayload = async (input: {
  createTicket: ReturnType<typeof useCreateProjectTicket>;
  payload: CreateTicketModalPayload;
  onCreated: () => void;
}) => {
  const { createTicket, payload, onCreated } = input;
  if (createTicket.isPending) return;

  try {
    const createdTicket = await createTicket.mutateAsync({
      title: payload.content,
      content: payload.content,
      tagIds: payload.tagIds,
      status: payload.status,
      parentId: payload.parentId,
    });

    onCreated();

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

const TicketsPanelContent = (props: { projectId?: string }) => {
  const { projectId } = props;
  const { data: project } = useProject(projectId);
  const { data: tickets, sessionsByWorkspace } = useProjectTickets(projectId);
  const attemptStatusMap = useAttemptStatusMap(projectId);
  const updateTicketStatus = useUpdateProjectTicketStatus(projectId);
  const updateTicket = useUpdateProjectTicket(projectId);
  const deleteTicket = useDeleteProjectTicket(projectId);
  const createTicket = useCreateProjectTicket(projectId);
  const navigate = useNavigate();
  const openCommandPalette = useOpenCommandPalette();
  const openShortcutHelp = useOpenShortcutHelp();
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
  const resolvedProjectId = projectId ?? "";
  const requestCreateTicketRef = useRef<() => void>(() => undefined);

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

  requestCreateTicketRef.current = () => openCreateModal();

  const ticketsShell = useShell(() =>
    createDashboardTicketsShell({
      projectId: resolvedProjectId,
      projectName: project?.name ?? "Project",
      navigate: (path) => navigate({ to: path }),
      requestCreateTicket: () => requestCreateTicketRef.current(),
      requestCreateSession: () => {
        setSelectedSessionId(null);
        setSessionModalState("bubble");
      },
      openCommandPalette,
      openShortcutHelp,
    }),
  );

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

  const pluginActionTrigger = usePluginActionTrigger({
    projectId,
    targetType: "ticket",
    onSuccess: async (result) => {
      if (!result.session_id) return;
      await handleOpenSessionBubble(result.session_id);
    },
  });

  const handleMoveTicket = (ticketId: string, status: TicketStatus) => {
    const targetStatus = statusOptions.find((col) => col.id === status || col.name === status);
    const resolvedStatus = targetStatus?.name ?? status;

    updateTicketStatus.mutateAsync({ ticketId, status: resolvedStatus }).catch((error) => {
      console.error("[move ticket]", error);
    });
  };

  const handleCreateTicket = (payload: CreateTicketModalPayload) =>
    createTicketFromPayload({ createTicket, payload, onCreated: closeCreateModal });

  const handleConfirmDeleteTicket = async () => {
    if (!deleteTicketId) return;

    await deleteTicket.mutateAsync({ ticketId: deleteTicketId });
    setDeleteTicketId(null);
  };

  const handleColumnAction = async (status: TicketStatus, action: TicketColumnAction) => {
    if (action !== "archive_all") return;

    await archiveTicketsInColumn({ status, statusOptions, tickets: allTickets, updateTicket });
  };

  const resolveContextMenuActions = (ticketId: string, archived: boolean) =>
    buildTicketListContextMenuActions({
      ticketId,
      archived,
      projectId,
      updateTicket,
      deleteTicket,
      pluginActionTrigger,
      t,
      onDeleteOpen: () => setDeleteTicketId(ticketId),
    });

  const openTicketDetails = (ticket: { shorthand: string; title: string }) => {
    if (!projectId) return;
    void ticketsShell.resources.openResource(
      createProjectRouteResource(projectId, `tickets/${ticket.shorthand}`, ticket.title, "FileText"),
    );
  };

  const openTicketWorkspace = (ticket: { shorthand: string }, workspaceShorthand?: string) => {
    if (!projectId || !workspaceShorthand) return;
    void ticketsShell.resources.openResource(
      createProjectRouteResource(
        projectId,
        `tickets/${ticket.shorthand}/workspaces/${workspaceShorthand}`,
        workspaceShorthand,
        "GitBranch",
      ),
    );
  };

  useTicketsShellRenderers({
    shell: ticketsShell,
    renderMain: () => (
      <TicketsShellMainWidget
        boardMounted={boardMounted}
        viewMode={settings.viewMode}
        groups={groups}
        displayProperties={settings.displayProperties}
        badgeContext={badgeContext}
        latestAttemptsByTicketId={latestAttemptsByTicketId}
        diffTotalsByWorkspaceId={diffTotalsByWorkspaceId}
        attemptStatusMap={attemptStatusMap}
        sessionsByWorkspace={sessionsByWorkspace}
        onMoveTicket={handleMoveTicket}
        onSelectTicket={openTicketDetails}
        onOpenSessionBubble={handleOpenSessionBubble}
        onOpenTicketWorkspace={openTicketWorkspace}
        resolveContextMenuActions={(ticket) => resolveContextMenuActions(ticket.id, Boolean(ticket.archived))}
        onCreateStart={(status) => openCreateModal(status)}
        onColumnAction={handleColumnAction}
      />
    ),
  });

  useEffect(() => {
    const subscription = ticketsShell.breadcrumbs.setItems([
      { title: project?.name ?? "Project", icon: "FolderKanban" },
      { title: "Tickets", icon: "KanbanSquare" },
    ]);
    return () => subscription.dispose();
  }, [project?.name, ticketsShell]);

  return (
    <>
      <ShellWorkbench shell={ticketsShell} />

      <TicketsPanelDialogs
        createModalOpen={createModalOpen}
        createModalStatus={createModalStatus}
        deleteTicketId={deleteTicketId}
        isCreateTicketSubmitting={createTicket.isPending}
        projectId={projectId}
        projectName={project?.name}
        statusOptions={statusOptions}
        tags={tagDefs}
        t={t}
        onCloseCreateModal={closeCreateModal}
        onCloseDeleteTicket={() => setDeleteTicketId(null)}
        onConfirmDeleteTicket={handleConfirmDeleteTicket}
        onCreateTicket={handleCreateTicket}
      />

      {pluginActionTrigger.activeParamAction && projectId ? (
        <ActionParamsDialog
          open
          action={pluginActionTrigger.activeParamAction}
          projectId={projectId}
          isSubmitting={pluginActionTrigger.activeParamActionIsPending}
          onClose={pluginActionTrigger.cancelParams}
          onSubmit={(params) => pluginActionTrigger.submitWithParams(params)}
        />
      ) : null}
    </>
  );
};

export const TicketsPanel = () => {
  const { projectId } = useParams({ strict: false });

  return <TicketsPanelContent key={projectId ?? "tickets"} projectId={projectId} />;
};
