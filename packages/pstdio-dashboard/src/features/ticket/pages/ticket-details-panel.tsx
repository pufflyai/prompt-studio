import { Flex, Stack } from "@chakra-ui/react";
import { PanelLayout } from "@pstdio/ui";
import { MarkdownEditor } from "@pstdio/ui/rich-text";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useProject } from "@/features/project/hooks/use-project";
import { useArchiveSession } from "@/features/sessions/hooks/use-archive-session";
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
import { navigateToCreatedWorkspace, runWorkspaceCreation } from "@/features/workspaces/pages/workspace-page-helpers";
import { resolveWorkspaceSelection } from "@/features/workspaces/utils/workspace-selection";
import { useExtensionResourceContextMenuActions } from "@/shared/extensions/hooks/use-extension-resource-context-menu-actions";
import { useProjectSettingsStore } from "@/shared/stores/project-settings";
import { TicketDetailSidebar } from "../components/ticket-detail-sidebar";
import { TicketHeader } from "../components/ticket-header";
import { TicketImagePreview } from "../components/ticket-image-preview";
import { TicketSidebar } from "../components/ticket-sidebar";
import { useContentAutosave } from "../hooks/use-content-autosave";
import { useTicketContent } from "../hooks/use-ticket-content";
import { useTicketFiles } from "../hooks/use-ticket-files";
import { openTicketSessionBubble } from "../utils/open-ticket-session-bubble";
import { resolveParentTicketReference } from "../utils/resolve-parent-ticket-reference";
import { resolveSidebarSubTickets } from "../utils/sidebar-sub-tickets";
import { isTicketContentReady } from "../utils/ticket-content-ready";
import { resolveTicketDetailsState } from "../utils/ticket-details-state";
import {
  buildSelectableTicketFiles,
  isImageFileName,
  resolveSelectedTicketFile,
  TICKET_CONTENT_ITEM_ID,
} from "../utils/ticket-file-selection";
import { buildTicketBreadcrumbs, buildTicketOverflowActions, buildWorkspaceRoute } from "./ticket-details-actions";
import {
  buildTicketDetailsSessionContextMenuItems,
  buildTicketDetailsTicketContextMenuItems,
  buildTicketDetailsWorkspaceContextMenuItems,
} from "./ticket-details-context-menu";
import { TicketDetailsDialogs } from "./ticket-details-dialogs";
import { TicketDetailsStatusMessage } from "./ticket-details-status-message";

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: This panel orchestrates route state, editor autosave, and resource actions in one place.
export const TicketDetailsPanel = () => {
  const { projectId, ticketShorthand, selectedFileId } = useParams({ strict: false });
  const navigate = useNavigate();
  const { t } = useTranslation(["projects", "tickets"]);
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
  const sidebarSubTickets = ticket ? resolveSidebarSubTickets(allProjectTickets, ticket.id, ticket.shorthand) : [];
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
  const lastSelectedBranches = useProjectSettingsStore((state) => state.lastSelectedBranches);
  const lastSelectedRepo = useProjectSettingsStore((state) => state.lastSelectedRepo);

  const ticketContextMenuActions = useExtensionResourceContextMenuActions({
    slotId: ["ticket.headerPrimary", "ticket.headerOverflow"],
  });
  const workspaceContextMenuActions = useExtensionResourceContextMenuActions({
    slotId: ["workspace.headerPrimary", "workspace.headerOverflow"],
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

  const handleSelectSubTicket = async (subTicketShorthand: string) => {
    await autosave.flushPending();
    navigate({
      to: "/projects/$projectId/tickets/$ticketShorthand",
      params: { projectId, ticketShorthand: subTicketShorthand },
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
      lastSelectedBranches,
      lastSelectedRepo,
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
      subTickets={sidebarSubTickets}
      knownSubTicketIds={allProjectTickets.map((projectTicket) => projectTicket.id)}
      selectedFileId={selectedFile.id}
      workspaces={workspaces}
      attemptStatusMap={attemptStatusMap}
      diffTotalsByWorkspaceId={diffTotalsByWorkspaceId}
      sessionsByWorkspaceId={sessionsByWorkspaceId}
      onSelectFile={handleSelectFile}
      onSelectSubTicket={handleSelectSubTicket}
      onSelectWorkspace={handleSelectWorkspace}
      onSelectSession={handleSelectWorkspaceSession}
      onCreateWorkspace={() => setCreateWorkspaceOpen(true)}
      onSelectPlanning={() => {
        void navigateBack();
      }}
      resolveTicketContextMenuItems={() =>
        buildTicketDetailsTicketContextMenuItems({
          ticketContextMenuActions,
          projectId,
          ticket,
          defaultOverflowActions,
        })
      }
      resolveWorkspaceContextMenuItems={(workspace) =>
        buildTicketDetailsWorkspaceContextMenuItems({
          workspaceContextMenuActions,
          projectId,
          ticket,
          workspace,
          isDeletePending: deleteWorkspace.isPending,
          onDeleteWorkspace: () => setWorkspaceToDeleteId(workspace.id),
          t,
        })
      }
      resolveSessionContextMenuItems={(session) =>
        buildTicketDetailsSessionContextMenuItems({
          session,
          onArchiveSession: () => archiveSession.mutate(session.id),
          t,
        })
      }
    />
  );

  return (
    <PanelLayout sidebar={sidebar}>
      <Stack flex="1" gap="0" minH="0">
        <TicketHeader
          breadcrumbItems={breadcrumbs}
          defaultOverflowActions={defaultOverflowActions}
          resource={{
            type: "ticket",
            id: ticket.id,
            label: ticket.shorthand,
            projectId,
            metadata: { shorthand: ticket.shorthand, title: ticket.title },
          }}
          onNavigateBack={navigateBack}
        />

        <Flex flex="1" minH="0" overflow="hidden" css={{ containerType: "inline-size" }}>
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

      <TicketDetailsDialogs
        isCreateWorkspaceOpen={isCreateWorkspaceOpen}
        attemptsCount={workspaces.length}
        isCreateWorkspaceSubmitting={createAttempt.isPending}
        onCloseCreateWorkspace={() => setCreateWorkspaceOpen(false)}
        onConfirmCreateWorkspace={handleCreateEmptyWorkspace}
        ticketContextMenuParamsDialog={ticketContextMenuActions.paramsDialog}
        workspaceContextMenuParamsDialog={workspaceContextMenuActions.paramsDialog}
        isTicketDeleteOpen={isDeleteOpen}
        onCloseTicketDelete={() => setDeleteOpen(false)}
        onDeleteTicket={async () => {
          await deleteTicket.mutateAsync({ ticketId: ticket.id });
          setDeleteOpen(false);
          await navigateBack();
        }}
        isWorkspaceDeleteOpen={Boolean(workspaceToDeleteId)}
        onCloseWorkspaceDelete={() => setWorkspaceToDeleteId(null)}
        onDeleteWorkspace={async () => {
          if (!workspaceToDeleteId) return;
          await deleteWorkspace.mutateAsync({ workspaceId: workspaceToDeleteId });
          setWorkspaceToDeleteId(null);
        }}
        t={t}
      />
    </PanelLayout>
  );
};
