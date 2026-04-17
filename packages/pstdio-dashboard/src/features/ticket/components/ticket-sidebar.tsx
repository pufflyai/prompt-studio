import { Text } from "@chakra-ui/react";
import {
  resolveSessionIndicatorColor,
  resolveSessionIndicatorIcon,
  type SessionCompletionStatus,
  Sidebar,
  type SidebarNavigateEvent,
  type SidebarNode,
  type SidebarSection,
} from "@pstdio/ui";
import { Circle, FileCode, FileImage, FileJson, FileSpreadsheet, FileText, GitBranch, Plus } from "lucide-react";
import { createElement } from "react";
import { ProjectMenu } from "@/features/project/components/project-menu";
import { ProjectSidebarFooter } from "@/features/project/components/project-sidebar";
import type { TicketAttempt } from "@/features/ticket-list/types";
import type { AttemptStatusMapEntry } from "@/features/workspaces/hooks/attempt-status-map";
import type { WorkspaceSessionEntry } from "@/features/workspaces/hooks/use-workspace-sessions";
import { getAttemptLabelFromWorkspaceShorthand } from "@/features/workspaces/utils/workspace-shorthand";
import { type SelectableTicketFile, TICKET_CONTENT_ITEM_ID } from "../utils/ticket-file-selection";
import { buildWorkspaceStatusIndicatorTooltip } from "../utils/workspace-status-indicator";
import { resolveTicketSidebarActiveNodeIds } from "./ticket-sidebar-selection";

const TICKET_SIDEBAR_STORAGE_KEY = "ticket-sidebar";

const sessionIcon = (status: string) =>
  createElement(resolveSessionIndicatorIcon(status as SessionCompletionStatus), { size: 14 });

interface TicketSidebarProps {
  files: SelectableTicketFile[];
  selectedFileId: string;
  workspaces: TicketAttempt[];
  attemptStatusMap?: Map<string, AttemptStatusMapEntry>;
  sessionsByWorkspaceId: Map<string, WorkspaceSessionEntry[]>;
  selectedWorkspaceId?: string | null;
  activeSessionId?: string | null;
  onSelectFile: (fileId: string) => void;
  onSelectWorkspace: (workspaceShorthand: string) => void;
  onSelectSession: (workspaceShorthand: string, sessionId: string) => void;
  onCreateWorkspaceSessionDraft?: (workspaceId: string) => void;
  onSelectPlanning?: () => void;
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

const buildFilesSection = (files: SelectableTicketFile[]): SidebarSection => {
  const nodes: SidebarNode[] = [
    {
      id: `file:${TICKET_CONTENT_ITEM_ID}`,
      label: "Ticket",
      icon: <FileText size={14} />,
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

const buildWorkspacesSection = (
  workspaces: TicketAttempt[],
  attemptStatusMap: Map<string, AttemptStatusMapEntry>,
): SidebarSection => {
  const nodes: SidebarNode[] = workspaces.map((workspace) => {
    const attemptStatus = workspace.attemptStatusId ? attemptStatusMap.get(workspace.attemptStatusId) : undefined;

    return {
      id: `workspace:${workspace.id}`,
      label: getAttemptLabelFromWorkspaceShorthand(workspace.shorthand),
      icon: <GitBranch size={14} />,
      indicator: attemptStatus
        ? {
            icon: <Circle size={8} fill="currentColor" />,
            color: `var(--chakra-colors-${attemptStatus.color}-solid)`,
            tooltip: buildWorkspaceStatusIndicatorTooltip(attemptStatus),
          }
        : undefined,
      isNavigable: true,
      navigationIntent: { id: "select-workspace", payload: { workspaceShorthand: workspace.shorthand } },
    };
  });

  return {
    id: "workspaces",
    label: "Workspaces",
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
): SidebarSection => {
  const nodes: SidebarNode[] = sessions.map((session) => ({
    id: `session:${session.id}`,
    label: session.title,
    icon: sessionIcon(session.status),
    iconColor: resolveSessionIndicatorColor(session.status as SessionCompletionStatus),
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
    selectedFileId,
    workspaces,
    attemptStatusMap = new Map(),
    sessionsByWorkspaceId,
    selectedWorkspaceId,
    activeSessionId = null,
    onSelectFile,
    onSelectWorkspace,
    onSelectSession,
    onCreateWorkspaceSessionDraft,
    onSelectPlanning,
  } = props;

  const selectedWorkspace = selectedWorkspaceId ? workspaces.find((w) => w.id === selectedWorkspaceId) : null;
  const sessions = selectedWorkspaceId ? (sessionsByWorkspaceId.get(selectedWorkspaceId) ?? []) : [];

  const sections: SidebarSection[] = [
    ...(onSelectPlanning ? [buildPlanningSection()] : []),
    buildFilesSection(files),
    buildWorkspacesSection(workspaces, attemptStatusMap),
    ...(selectedWorkspace
      ? [
          buildSessionsSection(
            sessions,
            selectedWorkspace.id,
            selectedWorkspace.shorthand,
            onCreateWorkspaceSessionDraft,
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
    const intent = event.intent;
    if (!intent) return;

    if (intent.id === "select-file") {
      onSelectFile(intent.payload as string);
    }

    if (intent.id === "select-planning") {
      onSelectPlanning?.();
    }

    if (intent.id === "select-workspace") {
      const { workspaceShorthand } = intent.payload as { workspaceShorthand: string };
      onSelectWorkspace(workspaceShorthand);
    }

    if (intent.id === "select-session") {
      const { workspaceShorthand, sessionId } = intent.payload as { workspaceShorthand: string; sessionId: string };
      onSelectSession(workspaceShorthand, sessionId);
    }
  };

  return (
    <Sidebar
      storageKey={TICKET_SIDEBAR_STORAGE_KEY}
      sections={sections}
      activeNodeId={activeNodeIds}
      defaultExpandedSections={["files", "workspaces", "sessions"]}
      header={<ProjectMenu />}
      footer={<ProjectSidebarFooter />}
      onNavigate={handleNavigate}
      closable={false}
      width="240px"
    />
  );
};
