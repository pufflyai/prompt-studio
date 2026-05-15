import type { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { HeaderActionItem } from "@/features/plugin-actions/components/header-action-groups";
import type { usePluginActionTrigger } from "@/features/plugin-actions/hooks/use-plugin-action-trigger";
import type { useProject } from "@/features/project/hooks/use-project";
import type { useProjectTickets } from "@/features/ticket-list/hooks/use-project-tickets";
import type { TicketSubTicket } from "@/features/ticket-list/types";
import { WorkspaceDiffPanel } from "@/features/workspaces/components/workspace-diff-panel";
import type { WorkspaceListItem } from "@/features/workspaces/components/workspace-list-panel";
import type { useAttemptStatusMap } from "@/features/workspaces/hooks/use-attempt-status-map";
import type { WorkspaceSessionEntry } from "@/features/workspaces/hooks/use-workspace-sessions";
import { buildWorkspaceDeleteOverflowAction } from "@/features/workspaces/pages/workspace-page-actions";
import { WorkspacePageContent } from "@/features/workspaces/pages/workspace-page-content";
import { navigateToProjectTickets, navigateToWorkspaceTab } from "@/features/workspaces/pages/workspace-page-helpers";
import type { WorkspacePageTab } from "@/features/workspaces/pages/workspace-page-tab";
import type { transformFileDiffs } from "@/features/workspaces/utils/transform-diff";
import { getAttemptLabelFromWorkspaceShorthand } from "@/features/workspaces/utils/workspace-shorthand";
import type { ApiFileDiff, ApiWorkspaceArtifact } from "@/shared/api-types";
import {
  createDashboardWorkspaceShell,
  createWorkspaceResource,
  type DashboardWorkspaceNavigationState,
  WORKSPACE_MAIN_WIDGET_ID,
  WORKSPACE_NAVIGATION_TREE_ID,
} from "@/shared/shell/dashboard-workspace-shell";
import { registerShellHeaderActions } from "@/shared/shell/register-header-actions";
import {
  createTicketDetailsNavigationSections,
  openTicketDetailsNavigationResource,
} from "@/shared/shell/ticket-details/ticket-details-shell-navigation";
import { useShell } from "@/shared/shell/use-shell";

type WorkspaceTicket = NonNullable<ReturnType<typeof useProjectTickets>["data"]>[number];
type PluginActionTrigger = ReturnType<typeof usePluginActionTrigger>;

const WORKSPACE_HEADER_ACTION_COMMAND_PREFIX = "workspace.headerAction";

const resolveWorkspaceHeaderActionIcon = (action: HeaderActionItem) => {
  if (action.key === "delete-workspace") return "Trash2";
  return undefined;
};

const WorkspacePendingMainWidget = (props: {
  activeTab: WorkspacePageTab;
  onTabChange: (tab: WorkspacePageTab) => void;
}) => {
  const { activeTab, onTabChange } = props;

  return (
    <WorkspaceDiffPanel
      ticketId=""
      workspaceId={null}
      diffs={[]}
      artifacts={[]}
      changedFiles={[]}
      diffGeneration={0}
      loading
      activeTab={activeTab}
      onTabChange={onTabChange}
    />
  );
};

interface UseWorkspaceShellInput {
  activeSessionId: string | null;
  activeTab: WorkspacePageTab;
  artifacts: ApiWorkspaceArtifact[];
  attemptStatusMap: ReturnType<typeof useAttemptStatusMap>;
  attempts: WorkspaceTicket["attempts"];
  changedFiles: ApiFileDiff[];
  createAttemptIsPending: boolean;
  diffGeneration: number;
  diffTotalsByWorkspaceId: Map<string, { additions: number; deletions: number }>;
  diffs: ReturnType<typeof transformFileDiffs>;
  isCreateWorkspaceModalOpen: boolean;
  isDeleteOpen: boolean;
  isDiffLoading: boolean;
  isTicketDeleteOpen: boolean;
  navigate: ReturnType<typeof useNavigate>;
  pluginActionTrigger: PluginActionTrigger;
  project: ReturnType<typeof useProject>["data"];
  projectId: string | undefined;
  selectableFiles: Parameters<typeof createTicketDetailsNavigationSections>[0]["files"];
  selectedWorkspace: WorkspaceListItem | null;
  selectedWorkspaceLabel: string;
  sessionActionTrigger: PluginActionTrigger;
  sessionId: string | undefined;
  sessionsByWorkspaceId: Map<string, WorkspaceSessionEntry[]>;
  sidebarSubTickets: TicketSubTicket[];
  ticket: WorkspaceTicket | null;
  ticketActionTrigger: PluginActionTrigger;
  ticketShorthand: string | undefined;
  workspaceShorthand: string | undefined;
  closeCreateWorkspaceModal: () => void;
  closeDeleteModal: () => void;
  closeTicketDeleteModal: () => void;
  createEmptyWorkspace: () => Promise<boolean>;
  createWorkspace: () => void;
  deleteTicket: () => Promise<void>;
  deleteWorkspace: () => Promise<void>;
  deleteWorkspaceIsPending: boolean;
  onPluginAction: (actionKey: string, workspaceId: string) => void;
  openDeleteModal: () => void;
  selectFile: (fileId: string) => void;
  selectSession: (workspaceShorthand: string, sessionId: string) => void;
  selectSubTicket: (ticketShorthand: string) => void;
  selectWorkspace: (workspaceShorthand: string) => void;
}

export const useWorkspaceShell = (input: UseWorkspaceShellInput) => {
  const { t } = useTranslation(["projects", "tickets"]);
  const resolvedProjectId = input.projectId ?? "";
  const resolvedTicketShorthand = input.ticketShorthand ?? "ticket";
  const resolvedWorkspaceShorthand = input.workspaceShorthand ?? "workspace";
  const navigationRef = useRef<DashboardWorkspaceNavigationState>({
    getSections: () => [],
    openResource: () => undefined,
  });
  const workspaceShell = useShell(() =>
    createDashboardWorkspaceShell({
      projectId: resolvedProjectId,
      projectName: input.project?.name ?? "Project",
      ticketShorthand: resolvedTicketShorthand,
      workspaceShorthand: resolvedWorkspaceShorthand,
      navigation: navigationRef,
      navigate: (path) => input.navigate({ to: path }),
    }),
  );

  const defaultOverflowActions = buildWorkspaceDeleteOverflowAction({
    t,
    hasSelectedWorkspace: Boolean(input.selectedWorkspace),
    isMutationPending: input.deleteWorkspaceIsPending,
    onDeleteWorkspace: input.openDeleteModal,
  });

  navigationRef.current = {
    getSections: () =>
      input.ticket
        ? createTicketDetailsNavigationSections({
            attemptStatusMap: input.attemptStatusMap,
            diffTotalsByWorkspaceId: input.diffTotalsByWorkspaceId,
            files: input.selectableFiles,
            projectId: resolvedProjectId,
            sessionsByWorkspaceId: input.sessionsByWorkspaceId,
            subTickets: input.sidebarSubTickets,
            ticketShorthand: input.ticket.shorthand,
            workspaces: input.attempts,
            onCreateWorkspace: input.createWorkspace,
          })
        : [],
    openResource: (resource) =>
      openTicketDetailsNavigationResource(resource, {
        onSelectFile: input.selectFile,
        onSelectPlanning: () => navigateToProjectTickets(input.navigate, input.projectId),
        onSelectSession: input.selectSession,
        onSelectSubTicket: input.selectSubTicket,
        onSelectWorkspace: input.selectWorkspace,
      }),
  };

  const navigationRefreshKey = [
    input.ticket?.id,
    input.selectableFiles.map((file) => file.id).join(","),
    input.sidebarSubTickets.map((subTicket) => subTicket.id).join(","),
    input.attempts
      .map((workspace) => `${workspace.id}:${workspace.sessionStatus}:${workspace.attemptStatusId ?? ""}`)
      .join(","),
    input.sessionsByWorkspaceId.size,
    input.attemptStatusMap.size,
    input.diffTotalsByWorkspaceId.size,
  ].join("|");
  const selectedNavigationNodeId = input.activeSessionId
    ? `session:${input.activeSessionId}`
    : input.selectedWorkspace
      ? `workspace:${input.selectedWorkspace.id}`
      : undefined;
  const navigationStateKey = `${selectedNavigationNodeId ?? ""}|${navigationRefreshKey}`;

  useEffect(() => {
    workspaceShell.layout.openWidget(WORKSPACE_MAIN_WIDGET_ID, {
      resource: createWorkspaceResource(resolvedProjectId, resolvedTicketShorthand, resolvedWorkspaceShorthand),
    });
  }, [resolvedProjectId, resolvedTicketShorthand, resolvedWorkspaceShorthand, workspaceShell]);

  useEffect(() => {
    const main = workspaceShell.renderers.registerRenderer({
      id: WORKSPACE_MAIN_WIDGET_ID,
      render: () =>
        input.ticket ? (
          <WorkspacePageContent
            projectId={input.projectId}
            ticket={input.ticket}
            selectedWorkspace={input.selectedWorkspace}
            diffs={input.diffs}
            artifacts={input.artifacts}
            changedFiles={input.changedFiles}
            diffGeneration={input.diffGeneration}
            isDiffLoading={input.isDiffLoading}
            attempts={input.attempts}
            createAttemptIsPending={input.createAttemptIsPending}
            selectedTab={input.activeTab}
            selectTab={(tab) =>
              navigateToWorkspaceTab({
                navigate: input.navigate,
                projectId: input.projectId,
                ticketShorthand: input.ticketShorthand,
                workspaceShorthand: input.workspaceShorthand,
                sessionId: input.sessionId,
                tab,
              })
            }
            isCreateWorkspaceModalOpen={input.isCreateWorkspaceModalOpen}
            closeCreateWorkspaceModal={input.closeCreateWorkspaceModal}
            createWorkspaceLabel={t("tickets:createWorkspaceModal.createWorkspace", {
              defaultValue: "Create workspace",
            })}
            createWorkspaceDescription={t("tickets:createWorkspaceModal.createWorkspaceDescription", {
              defaultValue: "Create a workspace now and start a session later.",
            })}
            createEmptyWorkspace={input.createEmptyWorkspace}
            pluginActionTrigger={input.pluginActionTrigger}
            ticketActionTrigger={input.ticketActionTrigger}
            sessionActionTrigger={input.sessionActionTrigger}
            isTicketDeleteOpen={input.isTicketDeleteOpen}
            closeTicketDeleteModal={input.closeTicketDeleteModal}
            deleteTicket={input.deleteTicket}
            isDeleteOpen={input.isDeleteOpen}
            closeDeleteModal={input.closeDeleteModal}
            deleteWorkspace={input.deleteWorkspace}
          />
        ) : (
          <WorkspacePendingMainWidget
            activeTab={input.activeTab}
            onTabChange={(tab) =>
              navigateToWorkspaceTab({
                navigate: input.navigate,
                projectId: input.projectId,
                ticketShorthand: input.ticketShorthand,
                workspaceShorthand: input.workspaceShorthand,
                sessionId: input.sessionId,
                tab,
              })
            }
          />
        ),
    });

    return () => {
      main.dispose();
    };
  });

  useEffect(() => {
    const ticketLabel = input.ticket ? `${input.ticket.shorthand} ${input.ticket.title}` : resolvedTicketShorthand;
    const workspaceLabel = getAttemptLabelFromWorkspaceShorthand(input.selectedWorkspaceLabel);
    const subscription = workspaceShell.breadcrumbs.setItems([
      { title: input.project?.name ?? "Project", icon: "FolderKanban" },
      {
        title: "Tickets",
        icon: "KanbanSquare",
        url: input.projectId ? `/projects/${input.projectId}/tickets` : undefined,
      },
      {
        title: ticketLabel,
        icon: "FileText",
        url:
          input.projectId && input.ticketShorthand
            ? `/projects/${input.projectId}/tickets/${input.ticketShorthand}`
            : undefined,
      },
      {
        title: workspaceLabel,
        icon: "GitBranch",
        url:
          input.projectId && input.ticketShorthand && input.workspaceShorthand
            ? `/projects/${input.projectId}/tickets/${input.ticketShorthand}/workspaces/${input.workspaceShorthand}`
            : undefined,
      },
    ]);
    return () => subscription.dispose();
  });

  useEffect(() => {
    if (!input.selectedWorkspace) return;

    return registerShellHeaderActions({
      category: "Workspaces",
      commandPrefix: WORKSPACE_HEADER_ACTION_COMMAND_PREFIX,
      defaultOverflowActions,
      onPluginAction: input.onPluginAction,
      overflowLabel: t("workspacePanel.options.workspace"),
      pendingActionKeys: input.pluginActionTrigger.pendingActionKeys,
      pluginActions: input.pluginActionTrigger.pluginActions,
      resolveIcon: resolveWorkspaceHeaderActionIcon,
      shell: workspaceShell,
      targetId: input.selectedWorkspace.id,
    });
  }, [
    defaultOverflowActions,
    input.onPluginAction,
    input.pluginActionTrigger.pendingActionKeys,
    input.pluginActionTrigger.pluginActions,
    input.selectedWorkspace,
    t,
    workspaceShell,
  ]);

  useEffect(() => {
    const [selectedNodeId] = navigationStateKey.split("|");
    workspaceShell.trees.setSelectedNode(WORKSPACE_NAVIGATION_TREE_ID, selectedNodeId || undefined);
    workspaceShell.trees.refresh(WORKSPACE_NAVIGATION_TREE_ID);
  }, [navigationStateKey, workspaceShell]);

  return workspaceShell;
};
