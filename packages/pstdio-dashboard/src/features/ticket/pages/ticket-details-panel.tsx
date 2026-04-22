import { Flex, Stack, Text } from "@chakra-ui/react";
import { DeleteConfirmationModal, PanelLayout } from "@pstdio/ui";
import { MarkdownEditor } from "@pstdio/ui/rich-text";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActionParamsDialog } from "@/features/plugin-actions/components/action-params-dialog";
import { usePluginActionTrigger } from "@/features/plugin-actions/hooks/use-plugin-action-trigger";
import {
  buildResourceContextMenuActions,
  toSidebarContextMenuItems,
} from "@/features/plugin-actions/hooks/use-resource-context-menu";
import { useProject } from "@/features/project/hooks/use-project";
import { useProjectSettingsStore, useProjectSettingsStoreApi } from "@/features/project-settings/store";
import { useArchiveSession } from "@/features/sessions/hooks/use-archive-session";
import { buildSessionOverflowActions } from "@/features/sessions/session-actions";
import { uploadTicketFile } from "@/features/ticket-list/data/api";
import { useCreateTicketAttempt } from "@/features/ticket-list/hooks/use-create-ticket-attempt";
import {
  useDeleteProjectTicket,
  useProjectTickets,
  useUpdateProjectTicket,
  useUpdateProjectTicketTags,
} from "@/features/ticket-list/hooks/use-project-tickets";
import {
  shouldFetchTicketAttemptDiff,
  useTicketAttemptDiffs,
} from "@/features/ticket-list/hooks/use-ticket-attempt-diffs";
import { useAttemptStatusMap } from "@/features/workspaces/hooks/use-attempt-status-map";
import { useDeleteWorkspace } from "@/features/workspaces/hooks/use-workspace-actions";
import { useWorkspaceSessions } from "@/features/workspaces/hooks/use-workspace-sessions";
import { buildWorkspaceDeleteOverflowAction } from "@/features/workspaces/pages/workspace-page-actions";
import { navigateToCreatedWorkspace, runWorkspaceCreation } from "@/features/workspaces/pages/workspace-page-helpers";
import { resolveWorkspaceSelection } from "@/features/workspaces/utils/workspace-selection";
import { CreateWorkspaceModal } from "../components/create-workspace-modal";
import { TicketDetailSidebar } from "../components/ticket-detail-sidebar";
import { TicketHeader } from "../components/ticket-header";
import { TicketImagePreview } from "../components/ticket-image-preview";
import { TicketSidebar } from "../components/ticket-sidebar";
import { useContentAutosave } from "../hooks/use-content-autosave";
import { useTicketContent } from "../hooks/use-ticket-content";
import { useTicketFiles } from "../hooks/use-ticket-files";
import { openTicketSessionBubble } from "../utils/open-ticket-session-bubble";
import { resolveParentTicketReference } from "../utils/resolve-parent-ticket-reference";
import { isTicketContentReady } from "../utils/ticket-content-ready";
import { resolveTicketDetailsState } from "../utils/ticket-details-state";
import {
  buildSelectableTicketFiles,
  isImageFileName,
  resolveSelectedTicketFile,
  TICKET_CONTENT_ITEM_ID,
} from "../utils/ticket-file-selection";
import { buildTicketBreadcrumbs, buildTicketOverflowActions, buildWorkspaceRoute } from "./ticket-details-actions";

const TicketDetailsStatusMessage = (props: { message: string }) => {
  const { message } = props;

  return (
    <Stack gap="lg" height="100%" p="sm">
      <Text textStyle="paragraph/S/regular" color="foreground.secondary">
        {message}
      </Text>
    </Stack>
  );
};

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: This panel orchestrates route state, editor autosave, and resource actions in one place.
export const TicketDetailsPanel = () => {
  const { projectId, ticketShorthand, selectedFileId } = useParams({ strict: false });
  const navigate = useNavigate();
  const { t } = useTranslation(["projects", "tickets"]);
  const projectSettingsStore = useProjectSettingsStoreApi();
  const setSessionModalState = useProjectSettingsStore((state) => state.setSessionModalState);
  const setSelectedSessionId = useProjectSettingsStore((state) => state.setSelectedSessionId);
  const sessionModalState = useProjectSettingsStore((state) => state.sessionModalState);

  const { data: project } = useProject(projectId);
  const { data: allTickets, isLoading: isTicketsLoading } = useProjectTickets(projectId);
  const createAttempt = useCreateTicketAttempt(projectId);
  const updateTicket = useUpdateProjectTicket(projectId);
  const updateTicketTags = useUpdateProjectTicketTags(projectId);
  const deleteTicket = useDeleteProjectTicket(projectId);
  const deleteWorkspace = useDeleteWorkspace();
  const archiveSession = useArchiveSession();

  const allProjectTickets = allTickets ?? [];
  const ticketState = resolveTicketDetailsState({ tickets: allTickets, ticketShorthand, isTicketsLoading });
  const ticket = ticketState.ticket;
  const parentReference = resolveParentTicketReference(allProjectTickets, ticket?.parentId);
  const ticketId = ticket?.id ?? "";
  const ticketFiles = useTicketFiles(ticket?.id);
  const selectableFiles = buildSelectableTicketFiles(ticketFiles.data);
  const selectedFile = resolveSelectedTicketFile(selectableFiles, selectedFileId);
  const isImageFile = isImageFileName(selectedFile.fileName);
  const ticketContent = useTicketContent(ticket?.id, selectedFile.id, { enabled: !isImageFile });
  const workspaces = ticket?.attempts ?? [];
  const attemptDiffInputs = workspaces.map((attempt) => ({
    workspaceId: attempt.id,
    shouldFetch: shouldFetchTicketAttemptDiff(attempt),
  }));
  const { diffTotalsByWorkspaceId } = useTicketAttemptDiffs(attemptDiffInputs);
  const attemptStatusMap = useAttemptStatusMap(projectId);
  const workspaceSessions = useWorkspaceSessions(workspaces.map((w) => w.id));
  const sessionsByWorkspaceId = workspaceSessions.sessionsByWorkspaceId;
  const content = ticketContent.data ?? "";
  const isContentReady = isTicketContentReady(ticketContent.data, ticketContent.isLoading);
  const [isDetailsPanelOpen, setIsDetailsPanelOpen] = useState(true),
    [isCreateWorkspaceOpen, setCreateWorkspaceOpen] = useState(false),
    [isDeleteOpen, setDeleteOpen] = useState(false),
    [workspaceToDeleteId, setWorkspaceToDeleteId] = useState<string | null>(null);
  const lastSelectedAgent = useProjectSettingsStore((state) => state.lastSelectedAgent);
  const lastSelectedModels = useProjectSettingsStore((state) => state.lastSelectedModels);
  const lastSelectedBranches = useProjectSettingsStore((state) => state.lastSelectedBranches);
  const lastSelectedRepo = useProjectSettingsStore((state) => state.lastSelectedRepo);

  const pluginActionTrigger = usePluginActionTrigger({
    projectId,
    targetType: "ticket",
    onSuccess: async (result) => {
      if (!result.session_id) return;
      openTicketSessionBubble({
        sessionId: result.session_id,
        sessionModalState: projectSettingsStore.getState().sessionModalState,
        setSessionModalState,
        setSelectedSessionId,
      });
    },
  });

  const workspaceActionTrigger = usePluginActionTrigger({
    projectId,
    targetType: "workspace",
    onSuccess: async (result) => {
      if (!result.session_id) return;
      openTicketSessionBubble({
        sessionId: result.session_id,
        sessionModalState: projectSettingsStore.getState().sessionModalState,
        setSessionModalState,
        setSelectedSessionId,
      });
    },
  });

  const sessionActionTrigger = usePluginActionTrigger({
    projectId,
    targetType: "session",
    onSuccess: async (result) => {
      if (!result.session_id) return;
      openTicketSessionBubble({
        sessionId: result.session_id,
        sessionModalState: projectSettingsStore.getState().sessionModalState,
        setSessionModalState,
        setSelectedSessionId,
      });
    },
  });

  const autosave = useContentAutosave({
    scopeKey: ticketId ? `ticket:${ticketId}:${selectedFile.id}` : "ticket:none",
    saveTargetId: selectedFile.id,
    content,
    onSave: async (id, nextContent) => {
      ticketContent.setOptimisticContent(nextContent);
      if (id === TICKET_CONTENT_ITEM_ID) {
        await updateTicket.mutateAsync({ ticketId, content: nextContent });
        return;
      }
      const attachment = selectableFiles.find((file) => file.id === id);
      if (!attachment) return;
      await uploadTicketFile(
        ticketId,
        new File([nextContent], attachment.fileName, {
          type: attachment.fileName.endsWith(".md") ? "text/markdown" : "text/plain",
        }),
      );
    },
  });

  const navigateBack = async () => {
    await autosave.flushPending();
    navigate({ to: "/projects/$projectId/tickets", params: { projectId } });
  };

  if (ticketState.state === "loading")
    return <TicketDetailsStatusMessage message={t("tickets:ticketDetail.loadingContent")} />;
  if (!ticket) return <TicketDetailsStatusMessage message={t("tickets:ticketDetail.ticketNotFound")} />;
  const handleSelectTicket = (id: string) => {
    const target = allProjectTickets.find((item) => item.id === id);
    if (!target) return;
    navigate({
      to: "/projects/$projectId/tickets/$ticketShorthand",
      params: { projectId, ticketShorthand: target.shorthand },
    });
  };
  const handleSelectFile = async (fileId: string) => {
    await autosave.flushPending();
    if (fileId === TICKET_CONTENT_ITEM_ID) {
      navigate({
        to: "/projects/$projectId/tickets/$ticketShorthand",
        params: { projectId, ticketShorthand: ticket.shorthand },
      });
      return;
    }
    navigate({
      to: "/projects/$projectId/tickets/$ticketShorthand/files/$selectedFileId",
      params: { projectId, ticketShorthand: ticket.shorthand, selectedFileId: fileId },
    });
  };

  const handleSelectWorkspace = (workspaceShorthand: string) => {
    if (!projectId) return;
    const workspace = workspaces.find((item) => item.shorthand === workspaceShorthand);
    const workspaceSessionsList = workspace ? (sessionsByWorkspaceId.get(workspace.id) ?? []) : [];
    const selection = resolveWorkspaceSelection({
      sessions: workspaceSessionsList,
    });
    navigate({
      ...buildWorkspaceRoute(projectId, ticket.shorthand, workspaceShorthand),
      search: selection.search,
    });
    if (selection.shouldClearSelection) {
      setSelectedSessionId(null);
      return;
    }
    openTicketSessionBubble({
      sessionId: selection.sessionIdToOpen,
      sessionModalState,
      setSessionModalState,
      setSelectedSessionId,
    });
  };

  const handleSelectWorkspaceSession = (workspaceShorthand: string, sessionId: string) => {
    if (!projectId) return;
    navigate({
      ...buildWorkspaceRoute(projectId, ticket.shorthand, workspaceShorthand),
      search: sessionId ? { sessionId } : {},
    });
  };

  const handleCreateEmptyWorkspace = () =>
    runWorkspaceCreation({
      ticket,
      projectId,
      project,
      createAttempt,
      lastSelectedAgent,
      lastSelectedModels,
      lastSelectedBranches,
      lastSelectedRepo,
      startSession: false,
      onSuccess: (result) => {
        navigateToCreatedWorkspace({
          navigate,
          setSelectedSessionId,
          projectId,
          ticketShorthand: ticket.shorthand,
          workspaceShorthand: result.workspaceShorthand,
        });
      },
    });

  const defaultOverflowActions = buildTicketOverflowActions({
    ticket,
    projectId,
    updateTicket,
    deleteTicket,
    onDeleteOpen: () => setDeleteOpen(true),
    t,
  });

  const breadcrumbs = buildTicketBreadcrumbs({
    ticketShorthand: ticket.shorthand,
    ticketTitle: ticket.title,
    parentShorthand: parentReference.shorthand,
    parentTitle: parentReference.ticket?.title ?? null,
    projectId,
  });

  const sidebar = (
    <TicketSidebar
      files={selectableFiles}
      selectedFileId={selectedFile.id}
      workspaces={workspaces}
      attemptStatusMap={attemptStatusMap}
      diffTotalsByWorkspaceId={diffTotalsByWorkspaceId}
      sessionsByWorkspaceId={sessionsByWorkspaceId}
      onSelectFile={handleSelectFile}
      onSelectWorkspace={handleSelectWorkspace}
      onSelectSession={handleSelectWorkspaceSession}
      onCreateWorkspace={() => setCreateWorkspaceOpen(true)}
      onSelectPlanning={() => {
        void navigateBack();
      }}
      resolveTicketContextMenuItems={() =>
        toSidebarContextMenuItems(
          buildResourceContextMenuActions({
            pluginActions: pluginActionTrigger.pluginActions,
            defaultOverflowActions,
            pendingActionKeys: pluginActionTrigger.pendingActionKeys,
            onPluginAction: (actionKey) => void pluginActionTrigger.trigger(actionKey, ticket.id),
          }),
        )
      }
      resolveWorkspaceContextMenuItems={(workspace) =>
        toSidebarContextMenuItems(
          buildResourceContextMenuActions({
            pluginActions: workspaceActionTrigger.pluginActions,
            defaultOverflowActions: buildWorkspaceDeleteOverflowAction({
              t,
              hasSelectedWorkspace: true,
              isMutationPending: deleteWorkspace.isPending,
              onDeleteWorkspace: () => setWorkspaceToDeleteId(workspace.id),
            }),
            pendingActionKeys: workspaceActionTrigger.pendingActionKeys,
            onPluginAction: (actionKey) => void workspaceActionTrigger.trigger(actionKey, workspace.id),
          }),
        )
      }
      resolveSessionContextMenuItems={(session) =>
        toSidebarContextMenuItems(
          buildResourceContextMenuActions({
            pluginActions: sessionActionTrigger.pluginActions,
            defaultOverflowActions: buildSessionOverflowActions({
              sessionId: session.id,
              agentSessionId: session.agentSessionId,
              onArchive: () => {
                archiveSession.mutate(session.id);
              },
              t,
            }),
            pendingActionKeys: sessionActionTrigger.pendingActionKeys,
            onPluginAction: (actionKey) => void sessionActionTrigger.trigger(actionKey, session.id),
          }),
        )
      }
    />
  );

  return (
    <PanelLayout sidebar={sidebar}>
      <Stack flex="1" gap="0" minH="0">
        <TicketHeader
          breadcrumbItems={breadcrumbs}
          pluginActions={pluginActionTrigger.pluginActions}
          defaultOverflowActions={defaultOverflowActions}
          pendingActionKeys={pluginActionTrigger.pendingActionKeys}
          onNavigateBack={navigateBack}
          onPluginAction={(actionKey) => void pluginActionTrigger.trigger(actionKey, ticket.id)}
        />

        <Flex flex="1" minH="0" overflow="hidden">
          <Stack flex="1" minW="0">
            {isImageFile ? (
              <TicketImagePreview ticketId={ticketId} fileId={selectedFile.id} fileName={selectedFile.fileName} />
            ) : isContentReady ? (
              <MarkdownEditor
                key={autosave.editorKey}
                defaultState={autosave.initialContent}
                isEditable
                placeholder={t("tickets:ticketDetail.enterDescription")}
                onChange={autosave.handleChange}
              />
            ) : null}
          </Stack>

          <TicketDetailSidebar
            ticket={ticket}
            project={project}
            allTickets={allProjectTickets}
            isOpen={isDetailsPanelOpen}
            isUpdatingTags={updateTicketTags.isPending}
            onToggle={() => setIsDetailsPanelOpen(!isDetailsPanelOpen)}
            onSelectTicket={handleSelectTicket}
            onTagIdsChange={(ids) => updateTicketTags.mutate({ ticketId: ticket.id, tagIds: ids })}
          />
        </Flex>
      </Stack>

      {isCreateWorkspaceOpen ? (
        <CreateWorkspaceModal
          open={isCreateWorkspaceOpen}
          attemptCount={workspaces.length}
          showAgentSelector={false}
          isSubmitting={createAttempt.isPending}
          confirmLabel={t("tickets:createWorkspaceModal.createWorkspace", { defaultValue: "Create workspace" })}
          description={t("tickets:createWorkspaceModal.createWorkspaceDescription", {
            defaultValue: "Create a workspace now and start a session later.",
          })}
          onClose={() => setCreateWorkspaceOpen(false)}
          onConfirm={handleCreateEmptyWorkspace}
        />
      ) : null}

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

      {workspaceActionTrigger.activeParamAction && projectId ? (
        <ActionParamsDialog
          open
          action={workspaceActionTrigger.activeParamAction}
          projectId={projectId}
          isSubmitting={workspaceActionTrigger.activeParamActionIsPending}
          onClose={workspaceActionTrigger.cancelParams}
          onSubmit={(params) => workspaceActionTrigger.submitWithParams(params)}
        />
      ) : null}

      {sessionActionTrigger.activeParamAction && projectId ? (
        <ActionParamsDialog
          open
          action={sessionActionTrigger.activeParamAction}
          projectId={projectId}
          isSubmitting={sessionActionTrigger.activeParamActionIsPending}
          onClose={sessionActionTrigger.cancelParams}
          onSubmit={(params) => sessionActionTrigger.submitWithParams(params)}
        />
      ) : null}

      <DeleteConfirmationModal
        open={isDeleteOpen}
        onClose={() => setDeleteOpen(false)}
        onDelete={async () => {
          await deleteTicket.mutateAsync({ ticketId: ticket.id });
          setDeleteOpen(false);
          await navigateBack();
        }}
        headline={t("projects:ticketPanel.deleteConfirmation.ticket.headline")}
        notificationText={t("projects:ticketPanel.deleteConfirmation.ticket.notification")}
        buttonText={t("projects:ticketPanel.options.deleteTicket")}
      />

      <DeleteConfirmationModal
        open={Boolean(workspaceToDeleteId)}
        onClose={() => setWorkspaceToDeleteId(null)}
        onDelete={async () => {
          if (!workspaceToDeleteId) return;
          await deleteWorkspace.mutateAsync({ workspaceId: workspaceToDeleteId });
          setWorkspaceToDeleteId(null);
        }}
        headline={t("workspacePanel.deleteConfirmation.workspace.headline")}
        notificationText={t("workspacePanel.deleteConfirmation.workspace.notification")}
        buttonText={t("workspacePanel.options.deleteWorkspace")}
      />
    </PanelLayout>
  );
};
