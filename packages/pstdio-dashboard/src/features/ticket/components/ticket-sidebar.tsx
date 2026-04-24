import { Text } from "@chakra-ui/react";
import {
  resolveSessionIndicatorColor,
  resolveSessionIndicatorIcon,
  type SessionCompletionStatus,
  Sidebar,
  type SidebarActionMenuItem,
  type SidebarNavigateEvent,
  type SidebarNode,
  type SidebarSection,
  WorkspaceBadge,
} from "@pstdio/ui";
import { FileCode, FileImage, FileJson, FileSpreadsheet, FileText, Plus } from "lucide-react";
import { createElement, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ProjectMenu } from "@/features/project/components/project-menu";
import { ProjectSidebarFooter } from "@/features/project/components/project-sidebar";
import type { TicketAttempt, TicketSubTicket } from "@/features/ticket-list/types";
import { toSessionIndicatorStatus } from "@/features/ticket-list/utils/ticket-attempts";
import type { AttemptStatusMapEntry } from "@/features/workspaces/hooks/attempt-status-map";
import type { WorkspaceSessionEntry } from "@/features/workspaces/hooks/use-workspace-sessions";
import { getAttemptLabelFromWorkspaceShorthand } from "@/features/workspaces/utils/workspace-shorthand";
import { type SelectableTicketFile, TICKET_CONTENT_ITEM_ID } from "../utils/ticket-file-selection";
import { resolveTicketSidebarActiveNodeIds } from "./ticket-sidebar-selection";
import { sortWorkspacesByLatestSession } from "./ticket-sidebar-workspaces";

const TICKET_SIDEBAR_STORAGE_KEY = "ticket-sidebar";

const sessionIcon = (status: string) =>
  createElement(resolveSessionIndicatorIcon(status as SessionCompletionStatus), { size: 14 });

interface TicketSidebarProps {
  files: SelectableTicketFile[];
  subTickets?: TicketSubTicket[];
  knownSubTicketIds?: string[];
  selectedFileId: string;
  workspaces: TicketAttempt[];
  attemptStatusMap?: Map<string, AttemptStatusMapEntry>;
  diffTotalsByWorkspaceId?: Map<string, { additions: number; deletions: number }>;
  sessionsByWorkspaceId: Map<string, WorkspaceSessionEntry[]>;
  selectedWorkspaceId?: string | null;
  activeSessionId?: string | null;
  onSelectFile: (fileId: string) => void;
  onSelectSubTicket?: (ticketShorthand: string) => void;
  onSelectWorkspace: (workspaceShorthand: string) => void;
  onSelectSession: (workspaceShorthand: string, sessionId: string) => void;
  onCreateWorkspaceSessionDraft?: (workspaceId: string) => void;
  onCreateWorkspace?: () => void;
  onSelectPlanning?: () => void;
  header?: ReactNode;
  footer?: ReactNode;
  resolveTicketContextMenuItems?: () => SidebarActionMenuItem[];
  resolveWorkspaceContextMenuItems?: (workspace: TicketAttempt) => SidebarActionMenuItem[];
  resolveSessionContextMenuItems?: (session: WorkspaceSessionEntry) => SidebarActionMenuItem[];
}

const PLANNING_ITEM_ID = "planning";

const getFileIcon = (fileName: string) => {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (["csv", "tsv", "xlsx", "xls"].includes(ext)) return <FileSpreadsheet size={14} />;
  if (ext === "json") return <FileJson size={14} />;
  if (["ts", "tsx", "js", "jsx", "py", "rb", "rs", "go", "java", "css", "scss", "html"].includes(ext)) {
    return <FileCode size={14} />;
  }
  if (["png", "jpg", "jpeg", "gif", "svg", "webp"].includes(ext)) return <FileImage size={14} />;
  return <FileText size={14} />;
};

const buildPlanningSection = (): SidebarSection => ({
  id: "planning",
  nodes: [
    {
      id: PLANNING_ITEM_ID,
      label: "<- Planning",
      isNavigable: true,
      navigationIntent: { id: "select-planning" },
    },
  ],
});

const buildFilesSection = (
  files: SelectableTicketFile[],
  resolveTicketContextMenuItems?: () => SidebarActionMenuItem[],
): SidebarSection => {
  const nodes: SidebarNode[] = [
    {
      id: `file:${TICKET_CONTENT_ITEM_ID}`,
      label: "Ticket",
      icon: <FileText size={14} />,
      contextMenuItems: resolveTicketContextMenuItems?.(),
      isNavigable: true,
      navigationIntent: { id: "select-file", payload: TICKET_CONTENT_ITEM_ID },
    },
    ...files.map((file) => ({
      id: `file:${file.id}`,
      label: file.label,
      icon: getFileIcon(file.fileName),
      isNavigable: true,
      navigationIntent: { id: "select-file", payload: file.id },
    })),
  ];

  return { id: "files", label: "Files", nodes };
};

export const buildSubTicketsSection = (
  subTickets: TicketSubTicket[],
  label: string,
  knownSubTicketIds: string[] = [],
  onSelectSubTicket?: (ticketShorthand: string) => void,
): SidebarSection | null => {
  if (subTickets.length === 0) {
    return null;
  }

  const knownTicketIdSet = new Set(knownSubTicketIds);
  const hasKnownTickets = knownTicketIdSet.size > 0;

  const nodes: SidebarNode[] = subTickets.map((subTicket) => {
    const label = subTicket.shorthand ? `${subTicket.shorthand} ${subTicket.title}` : subTicket.title;
    const canSelect =
      Boolean(onSelectSubTicket) &&
      subTicket.shorthand.length > 0 &&
      (!hasKnownTickets || knownTicketIdSet.has(subTicket.id));

    return {
      id: `sub-ticket:${subTicket.id}`,
      label,
      isNavigable: canSelect,
      disabled: !canSelect,
      navigationIntent: canSelect
        ? { id: "select-sub-ticket", payload: { ticketShorthand: subTicket.shorthand } }
        : undefined,
    };
  });

  return {
    id: "sub-tickets",
    label,
    collapsible: false,
    nodes,
  };
};

export const handleTicketSidebarNavigate = (
  event: SidebarNavigateEvent,
  handlers: {
    onSelectFile: (fileId: string) => void;
    onSelectPlanning?: () => void;
    onSelectSubTicket?: (ticketShorthand: string) => void;
    onSelectWorkspace: (workspaceShorthand: string) => void;
    onSelectSession: (workspaceShorthand: string, sessionId: string) => void;
  },
) => {
  const intent = event.intent;
  if (!intent) return;

  if (intent.id === "select-file") {
    handlers.onSelectFile(intent.payload as string);
  }

  if (intent.id === "select-planning") {
    handlers.onSelectPlanning?.();
  }

  if (intent.id === "select-workspace") {
    const { workspaceShorthand } = intent.payload as { workspaceShorthand: string };
    handlers.onSelectWorkspace(workspaceShorthand);
  }

  if (intent.id === "select-sub-ticket") {
    const { ticketShorthand } = intent.payload as { ticketShorthand: string };
    handlers.onSelectSubTicket?.(ticketShorthand);
  }

  if (intent.id === "select-session") {
    const { workspaceShorthand, sessionId } = intent.payload as { workspaceShorthand: string; sessionId: string };
    handlers.onSelectSession(workspaceShorthand, sessionId);
  }
};

export const buildWorkspacesSection = (
  workspaces: TicketAttempt[],
  attemptStatusMap: Map<string, AttemptStatusMapEntry>,
  diffTotalsByWorkspaceId: Map<string, { additions: number; deletions: number }>,
  sessionsByWorkspaceId: Map<string, WorkspaceSessionEntry[]>,
  onCreateWorkspace?: () => void,
  resolveWorkspaceContextMenuItems?: (workspace: TicketAttempt) => SidebarActionMenuItem[],
): SidebarSection => {
  const sortedWorkspaces = sortWorkspacesByLatestSession(workspaces, sessionsByWorkspaceId);

  const nodes: SidebarNode[] = sortedWorkspaces.map((workspace) => {
    const attemptStatus = workspace.attemptStatusId ? attemptStatusMap.get(workspace.attemptStatusId) : undefined;
    const diffTotals = diffTotalsByWorkspaceId.get(workspace.id);

    return {
      id: `workspace:${workspace.id}`,
      label: (
        <WorkspaceBadge
          workspaceType={workspace.worktreePath ? "worktree" : "current_branch"}
          shorthand={getAttemptLabelFromWorkspaceShorthand(workspace.shorthand)}
          attemptStatus={attemptStatus}
          sessionStatus={toSessionIndicatorStatus(workspace.sessionStatus)}
          showLeadingSessionIndicator={false}
          diffAdditions={diffTotals?.additions}
          diffDeletions={diffTotals?.deletions}
        />
      ),
      isNavigable: true,
      contextMenuItems: resolveWorkspaceContextMenuItems?.(workspace),
      navigationIntent: { id: "select-workspace", payload: { workspaceShorthand: workspace.shorthand } },
    };
  });

  return {
    id: "workspaces",
    label: "Workspaces",
    actions: onCreateWorkspace
      ? [
          {
            id: "new-workspace",
            label: "New workspace",
            icon: <Plus size={14} />,
            onAction: onCreateWorkspace,
          },
        ]
      : undefined,
    nodes,
    emptyState: (
      <Text textStyle="paragraph/S/regular" color="fg.muted" px="3" py="4" textAlign="center">
        No workspaces yet
      </Text>
    ),
  };
};

const buildSessionsSection = (
  sessions: WorkspaceSessionEntry[],
  workspaceId: string,
  workspaceShorthand: string,
  onCreateWorkspaceSessionDraft?: (workspaceId: string) => void,
  resolveSessionContextMenuItems?: (session: WorkspaceSessionEntry) => SidebarActionMenuItem[],
): SidebarSection => {
  const nodes: SidebarNode[] = sessions.map((session) => ({
    id: `session:${session.id}`,
    label: session.title,
    icon: sessionIcon(session.status),
    iconColor: resolveSessionIndicatorColor(session.status as SessionCompletionStatus),
    contextMenuItems: resolveSessionContextMenuItems?.(session),
    isNavigable: true,
    navigationIntent: {
      id: "select-session",
      payload: { workspaceShorthand, sessionId: session.id },
    },
  }));

  return {
    id: "sessions",
    label: "Sessions",
    actions: onCreateWorkspaceSessionDraft
      ? [
          {
            id: "new-session",
            label: "New session",
            icon: <Plus size={14} />,
            onAction: () => onCreateWorkspaceSessionDraft(workspaceId),
          },
        ]
      : undefined,
    nodes,
  };
};

export const TicketSidebar = (props: TicketSidebarProps) => {
  const {
    files,
    subTickets = [],
    knownSubTicketIds = [],
    selectedFileId,
    workspaces,
    attemptStatusMap = new Map(),
    diffTotalsByWorkspaceId = new Map(),
    sessionsByWorkspaceId,
    selectedWorkspaceId,
    activeSessionId = null,
    onSelectFile,
    onSelectSubTicket,
    onSelectWorkspace,
    onSelectSession,
    onCreateWorkspaceSessionDraft,
    onCreateWorkspace,
    onSelectPlanning,
    header = <ProjectMenu />,
    footer = <ProjectSidebarFooter />,
    resolveTicketContextMenuItems,
    resolveWorkspaceContextMenuItems,
    resolveSessionContextMenuItems,
  } = props;
  const { t } = useTranslation("tickets");

  const selectedWorkspace = selectedWorkspaceId ? workspaces.find((w) => w.id === selectedWorkspaceId) : null;
  const sessions = selectedWorkspaceId ? (sessionsByWorkspaceId.get(selectedWorkspaceId) ?? []) : [];
  const subTicketsSection = buildSubTicketsSection(
    subTickets,
    t("ticketDetail.subTickets"),
    knownSubTicketIds,
    onSelectSubTicket,
  );

  const sections: SidebarSection[] = [
    ...(onSelectPlanning ? [buildPlanningSection()] : []),
    buildFilesSection(files, resolveTicketContextMenuItems),
    ...(subTicketsSection ? [subTicketsSection] : []),
    buildWorkspacesSection(
      workspaces,
      attemptStatusMap,
      diffTotalsByWorkspaceId,
      sessionsByWorkspaceId,
      onCreateWorkspace,
      resolveWorkspaceContextMenuItems,
    ),
    ...(selectedWorkspace
      ? [
          buildSessionsSection(
            sessions,
            selectedWorkspace.id,
            selectedWorkspace.shorthand,
            onCreateWorkspaceSessionDraft,
            resolveSessionContextMenuItems,
          ),
        ]
      : []),
  ];

  const activeNodeIds = resolveTicketSidebarActiveNodeIds({
    selectedFileId,
    selectedWorkspaceId,
    activeSessionId,
    workspaceSessionIds: new Set(sessions.map((session) => session.id)),
  });

  const handleNavigate = (event: SidebarNavigateEvent) => {
    handleTicketSidebarNavigate(event, {
      onSelectFile,
      onSelectPlanning,
      onSelectSubTicket,
      onSelectWorkspace,
      onSelectSession,
    });
  };

  return (
    <Sidebar
      storageKey={TICKET_SIDEBAR_STORAGE_KEY}
      sections={sections}
      activeNodeId={activeNodeIds}
      defaultExpandedSections={["files", "sub-tickets", "workspaces", "sessions"]}
      header={header}
      footer={footer}
      onNavigate={handleNavigate}
      closable={false}
      width="240px"
    />
  );
};
