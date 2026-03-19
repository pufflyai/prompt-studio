import { Flex, Stack, Text } from "@chakra-ui/react";
import { MarkdownEditor } from "@pstdio/ui/rich-text";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useProject, useProjectTemplateAssets } from "@/features/project/hooks/use-project";
import { useProjectSettingsStore } from "@/features/project-settings/store";
import { CreateTicketModal } from "@/features/ticket-list/components/create-ticket-modal";
import { uploadTicketFile } from "@/features/ticket-list/data/api";
import {
  useDeleteProjectTicket,
  useProjectTickets,
  useUpdateProjectTicket,
  useUpdateProjectTicketTags,
} from "@/features/ticket-list/hooks/use-project-tickets";
import { BreakIntoSubTicketsModal } from "../components/break-into-sub-tickets-modal";
import { RefineTicketModal } from "../components/refine-ticket-modal";
import { TicketDetailSidebar } from "../components/ticket-detail-sidebar";
import { TicketHeader } from "../components/ticket-header";
import { useContentAutosave } from "../hooks/use-content-autosave";
import { useSubTicketCreation } from "../hooks/use-sub-ticket-creation";
import { useTicketAttemptDiff } from "../hooks/use-ticket-attempt-diff";
import { useTicketContent } from "../hooks/use-ticket-content";
import { useTicketFiles } from "../hooks/use-ticket-files";
import { useTicketSessions } from "../hooks/use-ticket-sessions";
import {
  buildCreateSubTicketsPrompt,
  buildImplementTicketPrompt,
  buildRefineTicketPrompt,
} from "../utils/build-prompts";
import { openTicketSessionBubble } from "../utils/open-ticket-session-bubble";
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

const findLatestAttempt = <T extends { updatedAt: string }>(attempts: T[]) => {
  let latestAttempt = attempts[0] ?? null;

  for (const attempt of attempts) {
    if (!latestAttempt || Date.parse(attempt.updatedAt) > Date.parse(latestAttempt.updatedAt)) {
      latestAttempt = attempt;
    }
  }

  return latestAttempt;
};

const findParentTicket = <T extends { id: string }>(tickets: T[], parentId: string | null | undefined) => {
  if (!parentId) return null;
  return tickets.find((ticket) => ticket.id === parentId) ?? null;
};

const toTicketTemplates = (templateAssets: Array<{ id: string; name: string; templateType: string }> | undefined) =>
  (templateAssets ?? [])
    .filter((asset) => asset.templateType === "ticket")
    .map((asset) => ({ id: asset.id, name: asset.name }));

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
  const { t } = useTranslation("tickets");

  const { data: project } = useProject(projectId);
  const { data: templateAssets } = useProjectTemplateAssets(projectId);
  const { data: allTickets, isLoading: isTicketsLoading } = useProjectTickets(projectId);
  const updateTicket = useUpdateProjectTicket(projectId);
  const updateTicketTags = useUpdateProjectTicketTags(projectId);
  const deleteTicket = useDeleteProjectTicket(projectId);

  const allProjectTickets = allTickets ?? [];
  const ticketState = resolveTicketDetailsState({
    tickets: allTickets,
    ticketShorthand,
    isTicketsLoading,
  });
  const ticket = ticketState.ticket;
  const parentTicket = findParentTicket(allProjectTickets, ticket?.parentId);
  const ticketId = ticket?.id ?? "";
  const ticketFiles = useTicketFiles(ticket?.id);
  const selectableFiles = buildSelectableTicketFiles(ticketFiles.data);
  const selectedFile = resolveSelectedTicketFile(selectableFiles, selectedFileId);
  const ticketContent = useTicketContent(ticket?.id, selectedFile.id);
  const content = ticketContent.data ?? "";
  const isContentReady = isTicketContentReady(ticketContent.data, ticketContent.isLoading);
  const ticketAttempts = ticket?.attempts ?? [];
  const defaultRepoId = project?.repositories[0]?.id || null;

  const lastSelectedAgent = useProjectSettingsStore((s) => s.lastSelectedAgent);
  const lastSelectedModels = useProjectSettingsStore((s) => s.lastSelectedModels);
  const lastSelectedBranches = useProjectSettingsStore((s) => s.lastSelectedBranches);
  const setSessionModalState = useProjectSettingsStore((s) => s.setSessionModalState);
  const setSelectedSessionId = useProjectSettingsStore((s) => s.setSelectedSessionId);

  const sessions = useTicketSessions({
    projectId,
    defaultRepoId,
    selectedAgent: lastSelectedAgent,
    selectedModel: lastSelectedModels[0] ?? "",
    selectedBranch: lastSelectedBranches[0] ?? "",
  });
  const subTicketCreation = useSubTicketCreation({
    projectId,
    parentTicketId: ticketId,
    statusOptions: project?.ticketStatusOptions ?? [],
  });
  const autosave = useContentAutosave({
    scopeKey: ticketId ? `ticket:${ticketId}:${selectedFile.id}` : "ticket:none",
    saveTargetId: selectedFile.id,
    content,
    onSave: async (id, c) => {
      ticketContent.setOptimisticContent(c);

      if (id === TICKET_CONTENT_ITEM_ID) {
        await updateTicket.mutateAsync({ ticketId, content: c });
        return;
      }

      const attachment = selectableFiles.find((file) => file.id === id);
      if (!attachment) return;

      await uploadTicketFile(
        ticketId,
        new File([c], attachment.fileName, {
          type: attachment.fileName.endsWith(".md") ? "text/markdown" : "text/plain",
        }),
      );
    },
  });

  const latestAttempt = findLatestAttempt(ticketAttempts);

  const { data: latestAttemptDiff } = useTicketAttemptDiff(latestAttempt?.id);
  const [isDetailsPanelOpen, setIsDetailsPanelOpen] = useState(true);
  const [isBreakModalOpen, setIsBreakModalOpen] = useState(false);
  const [isRefineModalOpen, setIsRefineModalOpen] = useState(false);

  const navigateBack = async () => {
    await autosave.flushPending();
    navigate({ to: "/projects/$projectId/tickets", params: { projectId } });
  };

  const templates = toTicketTemplates(templateAssets);

  if (ticketState.state === "loading") {
    return <TicketDetailsStatusMessage message={t("ticketDetail.loadingContent")} />;
  }

  if (!ticket) {
    return <TicketDetailsStatusMessage message={t("ticketDetail.ticketNotFound")} />;
  }

  const handleSelectTicket = (id: string) => {
    const target = allProjectTickets.find((t) => t.id === id);
    if (target)
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

  const handleRunAttempt = () => {
    return sessions.runAttempt(ticket.id, buildImplementTicketPrompt(ticket.shorthand)).then((sessionId) =>
      openTicketSessionBubble({
        sessionId,
        setSessionModalState,
        setSelectedSessionId,
      }),
    );
  };

  const handleViewWorkspace = () => {
    if (!projectId || !ticketShorthand || !latestAttempt) return;
    navigate({
      to: "/projects/$projectId/tickets/$ticketShorthand/workspaces/$workspaceShorthand",
      params: { projectId, ticketShorthand, workspaceShorthand: latestAttempt.shorthand },
    });
  };

  const breadcrumbs = buildTicketBreadcrumbs(ticket.shorthand, parentTicket?.shorthand ?? null, projectId);

  return (
    <Stack gap="0" height="100%">
      <TicketHeader
        breadcrumbItems={breadcrumbs}
        attemptCount={ticketAttempts.length}
        additions={latestAttemptDiff?.totals.additions ?? 0}
        deletions={latestAttemptDiff?.totals.deletions ?? 0}
        isRunningAttempt={sessions.isRunningAttempt}
        isArchived={Boolean(ticket.archived)}
        canDeleteTicket={Boolean(projectId) && !deleteTicket.isPending}
        onNavigateBack={navigateBack}
        onRunAttempt={handleRunAttempt}
        onViewWorkspace={handleViewWorkspace}
        onCreateSubTicket={subTicketCreation.openCreateSubTicketModal}
        onBreakIntoSubTickets={() => setIsBreakModalOpen(true)}
        onRefineTicket={() => setIsRefineModalOpen(true)}
        onArchiveTicket={() => updateTicket.mutate({ ticketId: ticket.id, archived: !ticket.archived })}
        onDeleteTicket={async () => {
          await deleteTicket.mutateAsync({ ticketId: ticket.id });
          navigateBack();
        }}
      />
      <Flex flex="1" minH="0" overflow="hidden">
        <Stack flex="1" minW="0" padding="sm" overflow="auto">
          {isContentReady ? (
            <MarkdownEditor
              key={autosave.editorKey}
              defaultState={autosave.initialContent}
              isEditable
              placeholder={t("ticketDetail.enterDescription")}
              onChange={autosave.handleChange}
            />
          ) : null}
        </Stack>
        <TicketDetailSidebar
          ticket={ticket}
          project={project}
          allTickets={allProjectTickets}
          ticketFiles={ticketFiles.data}
          selectedFileId={selectedFile.id}
          isOpen={isDetailsPanelOpen}
          isUpdatingTags={updateTicketTags.isPending}
          onToggle={() => setIsDetailsPanelOpen(!isDetailsPanelOpen)}
          onSelectFile={handleSelectFile}
          onSelectTicket={handleSelectTicket}
          onComplexityChange={(c) => updateTicket.mutate({ ticketId: ticket.id, complexity: c })}
          onTagIdsChange={(ids) => updateTicketTags.mutate({ ticketId: ticket.id, tagIds: ids })}
        />
      </Flex>
      <CreateTicketModal
        open={subTicketCreation.createModalOpen}
        onClose={subTicketCreation.closeCreateSubTicketModal}
        onSubmit={subTicketCreation.handleCreateSubTicket}
        isSubmitting={subTicketCreation.isCreatingSubTicket}
        targetStatus={subTicketCreation.createModalStatus}
        templates={subTicketCreation.templates}
        parentId={subTicketCreation.parentId}
        title={t("ticketDetail.createSubTicket")}
        submitLabel={t("ticketDetail.createSubTicket")}
      />
      <BreakIntoSubTicketsModal
        open={isBreakModalOpen}
        onClose={() => setIsBreakModalOpen(false)}
        onSubmit={(tpl) =>
          sessions.startSession(buildCreateSubTicketsPrompt(ticket.shorthand, tpl ?? undefined)).then(Boolean)
        }
        ticketShorthand={ticket.shorthand}
        templates={templates}
        isSubmitting={sessions.isStartingSession}
      />
      <RefineTicketModal
        open={isRefineModalOpen}
        onClose={() => setIsRefineModalOpen(false)}
        onSubmit={(ctx, tpl) =>
          sessions.startSession(buildRefineTicketPrompt(ticket.shorthand, ctx, tpl ?? undefined)).then((sessionId) =>
            openTicketSessionBubble({
              sessionId,
              setSessionModalState,
              setSelectedSessionId,
            }),
          )
        }
        ticketShorthand={ticket.shorthand}
        templates={templates}
        isSubmitting={sessions.isStartingSession}
      />
    </Stack>
  );
};
