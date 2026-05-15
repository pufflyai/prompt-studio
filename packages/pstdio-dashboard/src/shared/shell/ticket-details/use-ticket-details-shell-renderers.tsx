import type { BreadcrumbItem } from "@pstdio/ui";
import type { ShellCore } from "pstdio-shell/core";
import type { ComponentProps, MutableRefObject } from "react";
import { useEffect } from "react";
import type { HeaderActionItem } from "@/features/plugin-actions/components/header-action-groups";
import type { usePluginActionTrigger } from "@/features/plugin-actions/hooks/use-plugin-action-trigger";
import type { useProject } from "@/features/project/hooks/use-project";
import type { useContentAutosave } from "@/features/ticket/hooks/use-content-autosave";
import { TicketDetailsShellMainWidget } from "@/features/ticket/pages/ticket-details-shell-main-widget";
import { TicketDetailsStatusMessage } from "@/features/ticket/pages/ticket-details-status-message";
import type { resolveTicketDetailsState } from "@/features/ticket/utils/ticket-details-state";
import type { resolveSelectedTicketFile } from "@/features/ticket/utils/ticket-file-selection";
import type { WorkspaceSessionEntry } from "@/features/workspaces/hooks/use-workspace-sessions";
import {
  createTicketDetailsResource,
  type DashboardTicketDetailsNavigationController,
  type DashboardTicketDetailsNavigationState,
  TICKET_DETAILS_MAIN_WIDGET_ID,
  TICKET_DETAILS_NAVIGATION_TREE_ID,
} from "@/shared/shell/ticket-details/dashboard-ticket-details-module";
import { buildShellTreeContextMenuActions, registerShellHeaderActions } from "../register-header-actions";
import {
  createTicketDetailsNavigationSections,
  openTicketDetailsNavigationResource,
} from "./ticket-details-shell-navigation";

type TicketDetailsShell = Pick<ShellCore, "breadcrumbs" | "commands" | "layout" | "menus" | "renderers" | "trees">;
type PluginActionTrigger = ReturnType<typeof usePluginActionTrigger>;
type Ticket = NonNullable<ReturnType<typeof resolveTicketDetailsState>["ticket"]>;
type SelectedFile = ReturnType<typeof resolveSelectedTicketFile>;
type AutoSave = ReturnType<typeof useContentAutosave>;
type MainWidgetProps = ComponentProps<typeof TicketDetailsShellMainWidget>;
type Workspace = Parameters<typeof createTicketDetailsNavigationSections>[0]["workspaces"][number];

const TICKET_HEADER_ACTION_COMMAND_PREFIX = "ticket.details.headerAction";

const resolveTicketHeaderActionIcon = (action: HeaderActionItem) => {
  if (action.key === "archive-ticket") return "Archive";
  if (action.key === "delete-ticket") return "Trash2";
  return undefined;
};

const resolveResourceContextActionIcon = (action: HeaderActionItem) => {
  if (action.key === "archive-ticket") return "Archive";
  if (action.key === "delete-ticket") return "Trash2";
  if (action.key === "delete-workspace") return "Trash2";
  if (action.key === "copy-agent-session-id") return "Copy";
  if (action.key.startsWith("archive-session:")) return "Archive";
  return undefined;
};

interface UseTicketDetailsShellRenderersInput {
  allProjectTickets: MainWidgetProps["allTickets"];
  attemptStatusMap: NonNullable<Parameters<typeof createTicketDetailsNavigationSections>[0]["attemptStatusMap"]>;
  autoSaveEditorKey: string;
  autoSaveInitialContent: string;
  breadcrumbs: BreadcrumbItem[];
  defaultOverflowActions: HeaderActionItem[];
  diffTotalsByWorkspaceId: NonNullable<
    Parameters<typeof createTicketDetailsNavigationSections>[0]["diffTotalsByWorkspaceId"]
  >;
  isContentReady: boolean;
  isDetailsPanelOpen: boolean;
  isImageFile: boolean;
  navigation: MutableRefObject<DashboardTicketDetailsNavigationState> | DashboardTicketDetailsNavigationController;
  pluginActionTrigger: PluginActionTrigger;
  project: ReturnType<typeof useProject>["data"];
  projectId?: string;
  resolvedProjectId: string;
  selectableFiles: Parameters<typeof createTicketDetailsNavigationSections>[0]["files"];
  selectedFile: SelectedFile;
  sessionActionTrigger: PluginActionTrigger;
  sessionsByWorkspaceId: Parameters<typeof createTicketDetailsNavigationSections>[0]["sessionsByWorkspaceId"];
  shell: TicketDetailsShell;
  sidebarSubTickets: Parameters<typeof createTicketDetailsNavigationSections>[0]["subTickets"];
  statusMessage: string | null;
  ticket: Ticket | null | undefined;
  ticketId: string;
  updateTicketTags: { isPending: boolean; mutate: (input: { ticketId: string; tagIds: string[] }) => void };
  workspaceActionTrigger: PluginActionTrigger;
  workspaces: Parameters<typeof createTicketDetailsNavigationSections>[0]["workspaces"];
  resolveSessionContextDefaultActions: (session: WorkspaceSessionEntry) => HeaderActionItem[];
  resolveWorkspaceContextDefaultActions: (workspace: Workspace) => HeaderActionItem[];
  onCreateWorkspace: () => void;
  onEditorChange: AutoSave["handleChange"];
  onPluginAction: (actionKey: string, ticketId: string) => void;
  onSelectFile: (fileId: string) => void;
  onSelectPlanning: () => void;
  onSelectSession: (workspaceShorthand: string, sessionId: string) => void;
  onSelectSubTicket: (ticketShorthand: string) => void;
  onSelectTicket: MainWidgetProps["onSelectTicket"];
  onSelectWorkspace: (workspaceShorthand: string) => void;
  onTagIdsChange: MainWidgetProps["onTagIdsChange"];
  onToggleDetailsPanel: MainWidgetProps["onToggleDetailsPanel"];
  placeholder: string;
}

export const useTicketDetailsShellRenderers = (input: UseTicketDetailsShellRenderersInput) => {
  const {
    allProjectTickets,
    attemptStatusMap,
    autoSaveEditorKey,
    autoSaveInitialContent,
    breadcrumbs,
    defaultOverflowActions,
    diffTotalsByWorkspaceId,
    isContentReady,
    isDetailsPanelOpen,
    isImageFile,
    navigation,
    pluginActionTrigger,
    project,
    projectId,
    resolvedProjectId,
    selectableFiles,
    selectedFile,
    sessionActionTrigger,
    sessionsByWorkspaceId,
    shell,
    sidebarSubTickets,
    statusMessage,
    ticket,
    ticketId,
    updateTicketTags,
    workspaceActionTrigger,
    workspaces,
    resolveSessionContextDefaultActions,
    resolveWorkspaceContextDefaultActions,
    onCreateWorkspace,
    onEditorChange,
    onPluginAction,
    onSelectFile,
    onSelectPlanning,
    onSelectSession,
    onSelectSubTicket,
    onSelectTicket,
    onSelectWorkspace,
    onTagIdsChange,
    onToggleDetailsPanel,
    placeholder,
  } = input;

  navigation.current = {
    getSections: () =>
      ticket
        ? createTicketDetailsNavigationSections({
            attemptStatusMap,
            diffTotalsByWorkspaceId,
            files: selectableFiles,
            projectId: resolvedProjectId,
            sessionsByWorkspaceId,
            subTickets: sidebarSubTickets,
            ticketShorthand: ticket.shorthand,
            workspaces,
            resolveSessionContextMenuActions: (session) =>
              buildShellTreeContextMenuActions({
                defaultOverflowActions: resolveSessionContextDefaultActions(session),
                onPluginAction: (actionKey, targetId) => void sessionActionTrigger.trigger(actionKey, targetId),
                pendingActionKeys: sessionActionTrigger.pendingActionKeys,
                pluginActions: sessionActionTrigger.pluginActions,
                resolveIcon: resolveResourceContextActionIcon,
                targetId: session.id,
              }),
            resolveTicketContextMenuActions: () =>
              buildShellTreeContextMenuActions({
                defaultOverflowActions,
                onPluginAction,
                pendingActionKeys: pluginActionTrigger.pendingActionKeys,
                pluginActions: pluginActionTrigger.pluginActions,
                resolveIcon: resolveResourceContextActionIcon,
                targetId: ticket.id,
              }),
            resolveWorkspaceContextMenuActions: (workspace) =>
              buildShellTreeContextMenuActions({
                defaultOverflowActions: resolveWorkspaceContextDefaultActions(workspace),
                onPluginAction: (actionKey, targetId) => void workspaceActionTrigger.trigger(actionKey, targetId),
                pendingActionKeys: workspaceActionTrigger.pendingActionKeys,
                pluginActions: workspaceActionTrigger.pluginActions,
                resolveIcon: resolveResourceContextActionIcon,
                targetId: workspace.id,
              }),
            onCreateWorkspace,
          })
        : [],
    openResource: (resource) =>
      openTicketDetailsNavigationResource(resource, {
        onSelectFile,
        onSelectPlanning,
        onSelectSession,
        onSelectSubTicket,
        onSelectWorkspace,
      }),
  };
  const navigationRefreshKey = [
    ticket?.id,
    selectableFiles.map((file) => file.id).join(","),
    sidebarSubTickets.map((subTicket) => subTicket.id).join(","),
    workspaces
      .map((workspace) => `${workspace.id}:${workspace.sessionStatus}:${workspace.attemptStatusId ?? ""}`)
      .join(","),
    sessionsByWorkspaceId.size,
    attemptStatusMap.size,
    diffTotalsByWorkspaceId.size,
  ].join("|");
  const navigationStateKey = `file:${selectedFile.id}|${navigationRefreshKey}`;

  useEffect(() => {
    if (!ticket) return;
    shell.layout.openWidget(TICKET_DETAILS_MAIN_WIDGET_ID, {
      resource: createTicketDetailsResource(resolvedProjectId, ticket.shorthand, ticket.title),
      closable: false,
    });
  }, [resolvedProjectId, shell, ticket]);

  useEffect(() => {
    if (!ticket) return;

    return registerShellHeaderActions({
      category: "Tickets",
      commandPrefix: TICKET_HEADER_ACTION_COMMAND_PREFIX,
      defaultOverflowActions,
      onPluginAction,
      pendingActionKeys: pluginActionTrigger.pendingActionKeys,
      pluginActions: pluginActionTrigger.pluginActions,
      resolveIcon: resolveTicketHeaderActionIcon,
      shell,
      targetId: ticket.id,
    });
  }, [
    defaultOverflowActions,
    onPluginAction,
    pluginActionTrigger.pendingActionKeys,
    pluginActionTrigger.pluginActions,
    shell,
    ticket,
  ]);

  useEffect(() => {
    const subscription = shell.breadcrumbs.setItems([
      { title: project?.name ?? "Project", icon: "FolderKanban" },
      { title: "Tickets", icon: "KanbanSquare", url: projectId ? `/projects/${projectId}/tickets` : undefined },
      ...breadcrumbs.map((item) => ({ title: item.title, icon: "FileText", url: item.url })),
    ]);
    return () => subscription.dispose();
  });

  useEffect(() => {
    const main = shell.renderers.registerRenderer({
      id: TICKET_DETAILS_MAIN_WIDGET_ID,
      render: () =>
        statusMessage || !ticket ? (
          <TicketDetailsStatusMessage message={statusMessage ?? ""} />
        ) : (
          <TicketDetailsShellMainWidget
            allTickets={allProjectTickets}
            autoSaveEditorKey={autoSaveEditorKey}
            autoSaveInitialContent={autoSaveInitialContent}
            isContentReady={isContentReady}
            isDetailsPanelOpen={isDetailsPanelOpen}
            isImageFile={isImageFile}
            isUpdatingTags={updateTicketTags.isPending}
            project={project}
            selectedFileId={selectedFile.id}
            selectedFileName={selectedFile.fileName}
            ticket={ticket}
            ticketId={ticketId}
            onEditorChange={onEditorChange}
            onSelectTicket={onSelectTicket}
            onTagIdsChange={onTagIdsChange}
            onToggleDetailsPanel={onToggleDetailsPanel}
            placeholder={placeholder}
          />
        ),
    });

    return () => {
      main.dispose();
    };
  });

  useEffect(() => {
    const [selectedNodeId] = navigationStateKey.split("|");
    shell.trees.setSelectedNode(TICKET_DETAILS_NAVIGATION_TREE_ID, selectedNodeId);
    shell.trees.refresh(TICKET_DETAILS_NAVIGATION_TREE_ID);
  }, [navigationStateKey, shell]);
};
