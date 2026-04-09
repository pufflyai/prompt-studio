import { Flex, Stack, Text } from "@chakra-ui/react";
import { DeleteConfirmationModal, PanelLayout } from "@pstdio/ui";
import { MarkdownEditor } from "@pstdio/ui/rich-text";
import { useNavigate, useParams } from "@tanstack/react-router";
import { Archive, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActionParamsDialog } from "@/features/plugin-actions/components/action-params-dialog";
import type { HeaderActionItem } from "@/features/plugin-actions/components/header-action-groups";
import { usePluginActionTrigger } from "@/features/plugin-actions/hooks/use-plugin-action-trigger";
import { useProject } from "@/features/project/hooks/use-project";
import { useProjectSettingsStore } from "@/features/project-settings/store";
import { uploadTicketFile } from "@/features/ticket-list/data/api";
import {
  useDeleteProjectTicket,
  useProjectTickets,
  useUpdateProjectTicket,
  useUpdateProjectTicketTags,
} from "@/features/ticket-list/hooks/use-project-tickets";
import { useAttemptStatusMap } from "@/features/workspaces/hooks/use-attempt-status-map";
import { useWorkspaceSessions } from "@/features/workspaces/hooks/use-workspace-sessions";
import { TicketDetailSidebar } from "../components/ticket-detail-sidebar";
import { TicketHeader } from "../components/ticket-header";
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
  resolveSelectedTicketFile,
  TICKET_CONTENT_ITEM_ID,
} from "../utils/ticket-file-selection";

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

const buildTicketBreadcrumbs = (ticketShorthand: string, parentShorthand: string | null, projectId: string) => {
  const ticketUrl = `/projects/${projectId}/tickets/${ticketShorthand}`;
  const breadcrumbs = [{ title: ticketShorthand, url: ticketUrl }];
  if (!parentShorthand) return breadcrumbs;

  const parentUrl = `/projects/${projectId}/tickets/${parentShorthand}`;
  return [{ title: parentShorthand, url: parentUrl }, ...breadcrumbs];
};

export const TicketDetailsPanel = () => {
  const { projectId, ticketShorthand, selectedFileId } = useParams({ strict: false });
  const navigate = useNavigate();
  const { t } = useTranslation(["projects", "tickets"]);
  const setSessionModalState = useProjectSettingsStore((state) => state.setSessionModalState);
  const setSelectedSessionId = useProjectSettingsStore((state) => state.setSelectedSessionId);

  const { data: project } = useProject(projectId);
  const { data: allTickets, isLoading: isTicketsLoading } = useProjectTickets(projectId);
  const updateTicket = useUpdateProjectTicket(projectId);
  const updateTicketTags = useUpdateProjectTicketTags(projectId);
  const deleteTicket = useDeleteProjectTicket(projectId);

  const allProjectTickets = allTickets ?? [];
  const ticketState = resolveTicketDetailsState({ tickets: allTickets, ticketShorthand, isTicketsLoading });
  const ticket = ticketState.ticket;
  const parentReference = resolveParentTicketReference(allProjectTickets, ticket?.parentId);
  const ticketId = ticket?.id ?? "";
  const ticketFiles = useTicketFiles(ticket?.id);
  const selectableFiles = buildSelectableTicketFiles(ticketFiles.data);
  const selectedFile = resolveSelectedTicketFile(selectableFiles, selectedFileId);
  const ticketContent = useTicketContent(ticket?.id, selectedFile.id);
  const workspaces = ticket?.attempts ?? [];
  const attemptStatusMap = useAttemptStatusMap(projectId);
  const workspaceIds = workspaces.map((w) => w.id);
  const sessionsByWorkspaceId = useWorkspaceSessions(workspaceIds);
  const content = ticketContent.data ?? "";
  const isContentReady = isTicketContentReady(ticketContent.data, ticketContent.isLoading);
  const [isDetailsPanelOpen, setIsDetailsPanelOpen] = useState(true);
  const [isDeleteOpen, setDeleteOpen] = useState(false);

  const pluginActionTrigger = usePluginActionTrigger({
    projectId,
    targetType: "ticket",
    onSuccess: async (result) => {
      if (!result.session_id) return;

      openTicketSessionBubble({
        sessionId: result.session_id,
        setSessionModalState,
        setSelectedSessionId,
        forceBubble: true,
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

  if (ticketState.state === "loading") {
    return <TicketDetailsStatusMessage message={t("tickets:ticketDetail.loadingContent")} />;
  }

  if (!ticket) {
    return <TicketDetailsStatusMessage message={t("tickets:ticketDetail.ticketNotFound")} />;
  }

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

    navigate({
      to: "/projects/$projectId/tickets/$ticketShorthand/workspaces/$workspaceShorthand",
      params: { projectId, ticketShorthand: ticket.shorthand, workspaceShorthand },
    });
  };

  const handleSelectWorkspaceSession = (workspaceShorthand: string, sessionId: string) => {
    if (!projectId) return;

    navigate({
      to: "/projects/$projectId/tickets/$ticketShorthand/workspaces/$workspaceShorthand",
      params: { projectId, ticketShorthand: ticket.shorthand, workspaceShorthand },
      search: sessionId ? { sessionId } : {},
    });
  };

  const defaultOverflowActions: HeaderActionItem[] = [
    {
      key: "archive-ticket",
      label: t(
        ticket.archived ? "projects:ticketPanel.options.unarchiveTicket" : "projects:ticketPanel.options.archiveTicket",
      ),
      kind: "default",
      icon: Archive,
      isDisabled: updateTicket.isPending,
      onClick: () => updateTicket.mutate({ ticketId: ticket.id, archived: !ticket.archived }),
    },
    {
      key: "delete-ticket",
      label: t("projects:ticketPanel.options.deleteTicket"),
      kind: "default",
      icon: Trash2,
      isDisabled: !projectId || deleteTicket.isPending,
      onClick: () => setDeleteOpen(true),
    },
  ];

  const breadcrumbs = buildTicketBreadcrumbs(ticket.shorthand, parentReference.shorthand, projectId);

  const sidebar = (
    <TicketSidebar
      files={selectableFiles}
      selectedFileId={selectedFile.id}
      workspaces={workspaces}
      attemptStatusMap={attemptStatusMap}
      sessionsByWorkspaceId={sessionsByWorkspaceId}
      onSelectFile={handleSelectFile}
      onSelectWorkspace={handleSelectWorkspace}
      onSelectSession={handleSelectWorkspaceSession}
    />
  );

  return (
    <PanelLayout sidebar={sidebar}>
      <Stack flex="1" gap="0" minH="0">
        <TicketHeader
          breadcrumbItems={breadcrumbs}
          pluginActions={pluginActionTrigger.pluginActions}
          defaultOverflowActions={defaultOverflowActions}
          pendingActionKey={pluginActionTrigger.pendingActionKey}
          isExecuting={pluginActionTrigger.isExecuting}
          onNavigateBack={navigateBack}
          onPluginAction={(actionKey) => void pluginActionTrigger.trigger(actionKey, ticket.id)}
        />

        <Flex flex="1" minH="0" overflow="hidden">
          <Stack flex="1" minW="0">
            {isContentReady ? (
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

      {pluginActionTrigger.activeParamAction && projectId ? (
        <ActionParamsDialog
          open
          action={pluginActionTrigger.activeParamAction}
          projectId={projectId}
          isSubmitting={pluginActionTrigger.isExecuting}
          onClose={pluginActionTrigger.cancelParams}
          onSubmit={(params) => pluginActionTrigger.submitWithParams(params)}
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
    </PanelLayout>
  );
};
