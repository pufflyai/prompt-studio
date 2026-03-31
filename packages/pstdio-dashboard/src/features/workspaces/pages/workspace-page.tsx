import { Flex, IconButton, Stack, Text } from "@chakra-ui/react";
import { Breadcrumb, HorizontalMenuStack } from "@pstdio/ui";
import { Link, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { useProject } from "@/features/project/hooks/use-project";
import { useProjectSettingsStore } from "@/features/project-settings/store";
import { CreateWorkspaceModal } from "@/features/ticket/components/create-workspace-modal";
import { useTicketAttemptDiff } from "@/features/ticket/hooks/use-ticket-attempt-diff";
import { useTicketFiles } from "@/features/ticket/hooks/use-ticket-files";
import { buildImplementTicketPrompt } from "@/features/ticket/utils/build-prompts";
import { useCreateTicketAttempt } from "@/features/ticket-list/hooks/use-create-ticket-attempt";
import { useProjectTickets } from "@/features/ticket-list/hooks/use-project-tickets";
import { isSessionSettled } from "@/features/ticket-list/utils/ticket-attempts";
import { useInvalidateDiffOnEdits } from "@/features/workspaces/hooks/use-invalidate-diff-on-edits";
import { transformFileDiffs } from "@/features/workspaces/utils/transform-diff";
import { logMutationError } from "@/lib/error-handlers";
import { WorkspaceConversationPanel } from "../components/workspace-conversation-panel";
import { WorkspaceDiffPanel } from "../components/workspace-diff-panel";
import { type WorkspaceListItem, WorkspaceListPanel } from "../components/workspace-list-panel";
import { useAttemptStatusMap } from "../hooks/use-attempt-status-map";
import { useWorkspaceSession } from "../hooks/use-workspace-session";
import { useWorkspaceSessions } from "../hooks/use-workspace-sessions";

export const WorkspacePage = () => {
  const { projectId, ticketShorthand, workspaceShorthand } = useParams({ strict: false });
  const { sessionId: searchSessionId } = useSearch({ strict: false });
  const navigate = useNavigate();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const { data: project } = useProject(projectId);
  const { data: allTickets = [] } = useProjectTickets(projectId);
  const ticket = allTickets.find((t) => t.shorthand === ticketShorthand) ?? null;
  const attempts = ticket?.attempts ?? [];
  const attemptStatusMap = useAttemptStatusMap(projectId);

  const createAttempt = useCreateTicketAttempt(projectId);
  const lastSelectedAgent = useProjectSettingsStore((s) => s.lastSelectedAgent);
  const lastSelectedModels = useProjectSettingsStore((s) => s.lastSelectedModels);
  const lastSelectedBranches = useProjectSettingsStore((s) => s.lastSelectedBranches);
  const lastSelectedRepo = useProjectSettingsStore((s) => s.lastSelectedRepo);

  const workspaces: WorkspaceListItem[] = attempts.map((attempt) => {
    const status = attempt.attemptStatusId ? attemptStatusMap.get(attempt.attemptStatusId) : undefined;
    return {
      id: attempt.id,
      label: attempt.label,
      shorthand: attempt.shorthand,
      updatedAt: attempt.updatedAt,
      worktreePath: attempt.worktreePath,
      setupError: attempt.setupError,
      attemptStatusName: status?.name,
      attemptStatusColor: status?.color,
    };
  });

  const workspaceIds = workspaces.map((w) => w.id);
  const sessionsByWorkspaceId = useWorkspaceSessions(workspaceIds);

  const selectedWorkspace = workspaces.find((w) => w.shorthand === workspaceShorthand) ?? null;
  const selectedAttempt = attempts.find((a) => a.shorthand === workspaceShorthand) ?? null;
  const latestSessionId = useWorkspaceSession(selectedWorkspace?.id ?? null);
  const sessionId = searchSessionId === "new" ? null : (searchSessionId ?? latestSessionId);
  const selectedWorkspaceLabel = selectedWorkspace?.shorthand ?? workspaceShorthand ?? "";
  const sessionSettled = isSessionSettled(selectedAttempt?.sessionStatus ?? null);

  const { data: diffData } = useTicketAttemptDiff(selectedWorkspace?.id, { enabled: sessionSettled });
  const diffs = diffData?.files ? transformFileDiffs(diffData.files) : [];
  const invalidateDiff = useInvalidateDiffOnEdits(selectedWorkspace?.id ?? null);

  const { data: ticketFilesData } = useTicketFiles(ticketShorthand);
  const artifacts = ticketFilesData?.artifacts ?? [];

  const handleCreateSession = (_workspaceId: string, wsShorthand: string) => {
    handleSelectSession(wsShorthand, "new");
  };

  const handleSelectSession = (workspaceShorthand: string, sessionId: string) => {
    if (!projectId || !ticketShorthand) return;

    navigate({
      to: "/projects/$projectId/tickets/$ticketShorthand/workspaces/$workspaceShorthand",
      params: { projectId, ticketShorthand, workspaceShorthand },
      search: sessionId ? { sessionId } : {},
    });
  };

  const handleRunAttempt = async () => {
    if (!ticket || !projectId || createAttempt.isPending) return false;

    const prompt = buildImplementTicketPrompt(ticket.shorthand);
    const repoId = lastSelectedRepo || project?.repositories[0]?.id || null;
    const branch = lastSelectedBranches[0]?.trim() ? lastSelectedBranches[0] : null;
    const model = lastSelectedModels[0]?.trim() ? lastSelectedModels[0] : null;

    try {
      const result = await createAttempt.mutateAsync({
        ticketId: ticket.id,
        agent: lastSelectedAgent,
        repoId,
        branch,
        model,
        prompt,
      });

      handleSelectSession(result.workspaceShorthand, "");
      return true;
    } catch (error) {
      logMutationError("run attempt", error);
      return false;
    }
  };

  if (!ticket) {
    return (
      <Stack gap="lg" height="100%" p="sm">
        <Text textStyle="paragraph/S/regular" color="foreground.secondary">
          Ticket not found.
        </Text>
      </Stack>
    );
  }

  return (
    <Stack gap="0" height="100%">
      <HorizontalMenuStack>
        <Flex align="center" gap="sm">
          {projectId ? (
            <IconButton aria-label="Back to tickets" variant="ghost" size="sm" asChild>
              <Link to="/projects/$projectId/tickets" params={{ projectId }}>
                <ArrowLeft size={14} />
              </Link>
            </IconButton>
          ) : null}

          <Breadcrumb
            separator="/"
            separatorGap="xs"
            linkComponent={Link}
            items={[
              {
                title: ticket.shorthand,
                url: projectId && ticketShorthand ? `/projects/${projectId}/tickets/${ticketShorthand}` : undefined,
              },
              {
                title: selectedWorkspaceLabel,
                url:
                  projectId && ticketShorthand && selectedWorkspaceLabel
                    ? `/projects/${projectId}/tickets/${ticketShorthand}/workspaces/${selectedWorkspaceLabel}`
                    : undefined,
              },
            ]}
          />
        </Flex>
      </HorizontalMenuStack>

      <Flex flex="1" minH="0">
        <WorkspaceListPanel
          workspaces={workspaces}
          sessionsByWorkspaceId={sessionsByWorkspaceId}
          activeSessionId={sessionId}
          onSelectSession={handleSelectSession}
          onCreateAttempt={() => setIsCreateModalOpen(true)}
          onCreateSession={handleCreateSession}
        />

        <WorkspaceConversationPanel
          sessionId={sessionId}
          workspaceId={selectedWorkspace?.id}
          setupError={selectedWorkspace?.setupError}
          onEditAction={invalidateDiff}
          onSessionCreated={(newSessionId) => {
            if (selectedWorkspace) {
              handleSelectSession(selectedWorkspace.shorthand, newSessionId);
            }
          }}
        />

        <WorkspaceDiffPanel
          diffs={diffs}
          artifacts={artifacts}
          baseRef={diffData?.base_ref}
          headRef={diffData?.head_ref}
        />
      </Flex>

      {isCreateModalOpen ? (
        <CreateWorkspaceModal
          open={isCreateModalOpen}
          attemptCount={attempts.length}
          isSubmitting={createAttempt.isPending}
          onClose={() => setIsCreateModalOpen(false)}
          onConfirm={handleRunAttempt}
        />
      ) : null}
    </Stack>
  );
};
