import type { ResourceRef, TreeNode, TreeViewSection } from "pstdio-shell/core";
import { TICKET_CONTENT_FILE_NAME, TICKET_CONTENT_ITEM_ID } from "@/features/ticket/utils/ticket-file-selection";
import type { TicketAttempt, TicketSubTicket } from "@/features/ticket-list/types";
import type { AttemptStatusMapEntry } from "@/features/workspaces/hooks/attempt-status-map";
import type { WorkspaceSessionEntry } from "@/features/workspaces/hooks/use-workspace-sessions";
import { getAttemptLabelFromWorkspaceShorthand } from "@/features/workspaces/utils/workspace-shorthand";
import { createTicketDetailsNavigationResource } from "../dashboard-ticket-details-shell";

interface SelectableNavigationFile {
  fileName: string;
  id: string;
  label: string;
}

interface CreateTicketDetailsNavigationSectionsInput {
  attemptStatusMap: Map<string, AttemptStatusMapEntry>;
  diffTotalsByWorkspaceId: Map<string, { additions: number; deletions: number }>;
  files: SelectableNavigationFile[];
  projectId: string;
  sessionsByWorkspaceId: Map<string, WorkspaceSessionEntry[]>;
  subTickets: TicketSubTicket[];
  ticketShorthand: string;
  workspaces: TicketAttempt[];
  resolveSessionContextMenuActions?: (session: WorkspaceSessionEntry) => TreeNode["contextMenuActions"];
  resolveTicketContextMenuActions?: () => TreeNode["contextMenuActions"];
  resolveWorkspaceContextMenuActions?: (workspace: TicketAttempt) => TreeNode["contextMenuActions"];
  onCreateWorkspace: () => void;
}

const createNavigationResource = (
  input: Pick<CreateTicketDetailsNavigationSectionsInput, "projectId" | "ticketShorthand"> & {
    id: string;
    label: string;
    metadata: Record<string, unknown>;
  },
) =>
  createTicketDetailsNavigationResource(input.projectId, input.ticketShorthand, input.id, input.label, input.metadata);

const resolveFileIcon = (fileName: string) => {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (["csv", "tsv", "xlsx", "xls"].includes(ext)) return "Table";
  if (ext === "json") return "FileJson";
  if (["ts", "tsx", "js", "jsx", "py", "rb", "rs", "go", "java", "css", "scss", "html"].includes(ext)) {
    return "FileCode";
  }
  if (["png", "jpg", "jpeg", "gif", "svg", "webp"].includes(ext)) return "FileImage";
  return "FileText";
};

const createFileNode = (
  input: Pick<CreateTicketDetailsNavigationSectionsInput, "projectId" | "ticketShorthand"> & {
    contextMenuActions?: TreeNode["contextMenuActions"];
    file: SelectableNavigationFile;
  },
): TreeNode => ({
  id: `file:${input.file.id}`,
  label: input.file.label,
  icon: resolveFileIcon(input.file.fileName),
  contextMenuActions: input.contextMenuActions,
  resource: createNavigationResource({
    projectId: input.projectId,
    ticketShorthand: input.ticketShorthand,
    id: `file:${input.file.id}`,
    label: input.file.label,
    metadata: { action: "select-file", fileId: input.file.id },
  }),
});

const createTicketContentFile = (): SelectableNavigationFile => ({
  id: TICKET_CONTENT_ITEM_ID,
  fileName: TICKET_CONTENT_FILE_NAME,
  label: "Ticket",
});

const createSubTicketNode = (
  input: Pick<CreateTicketDetailsNavigationSectionsInput, "projectId" | "ticketShorthand"> & {
    subTicket: TicketSubTicket;
  },
): TreeNode => {
  const label = input.subTicket.shorthand
    ? `${input.subTicket.shorthand} ${input.subTicket.title}`
    : input.subTicket.title;

  return {
    id: `sub-ticket:${input.subTicket.id}`,
    label,
    icon: "Circle",
    resource: createNavigationResource({
      projectId: input.projectId,
      ticketShorthand: input.ticketShorthand,
      id: `sub-ticket:${input.subTicket.id}`,
      label,
      metadata: { action: "select-sub-ticket", ticketShorthand: input.subTicket.shorthand },
    }),
  };
};

const createSessionNode = (
  input: Pick<
    CreateTicketDetailsNavigationSectionsInput,
    "projectId" | "resolveSessionContextMenuActions" | "ticketShorthand"
  > & {
    session: WorkspaceSessionEntry;
    workspaceShorthand: string;
  },
): TreeNode => ({
  id: `session:${input.session.id}`,
  label: input.session.title,
  icon: "Terminal",
  contextMenuActions: input.resolveSessionContextMenuActions?.(input.session),
  resource: createNavigationResource({
    projectId: input.projectId,
    ticketShorthand: input.ticketShorthand,
    id: `session:${input.session.id}`,
    label: input.session.title,
    metadata: {
      action: "select-session",
      sessionId: input.session.id,
      workspaceShorthand: input.workspaceShorthand,
    },
  }),
});

const createWorkspaceDescription = (
  workspace: TicketAttempt,
  attemptStatusMap: Map<string, AttemptStatusMapEntry>,
  diffTotalsByWorkspaceId: Map<string, { additions: number; deletions: number }>,
) => {
  const attemptStatus = workspace.attemptStatusId ? attemptStatusMap.get(workspace.attemptStatusId)?.name : undefined;
  const diffTotals = diffTotalsByWorkspaceId.get(workspace.id);
  const diff = diffTotals ? `+${diffTotals.additions} -${diffTotals.deletions}` : undefined;

  return [attemptStatus, diff].filter(Boolean).join(" ");
};

const createWorkspaceNode = (
  input: Pick<
    CreateTicketDetailsNavigationSectionsInput,
    | "attemptStatusMap"
    | "diffTotalsByWorkspaceId"
    | "projectId"
    | "resolveSessionContextMenuActions"
    | "resolveWorkspaceContextMenuActions"
    | "sessionsByWorkspaceId"
    | "ticketShorthand"
  > & {
    workspace: TicketAttempt;
  },
): TreeNode => {
  const label = getAttemptLabelFromWorkspaceShorthand(input.workspace.shorthand);
  const sessions = input.sessionsByWorkspaceId.get(input.workspace.id) ?? [];

  return {
    id: `workspace:${input.workspace.id}`,
    label,
    description: createWorkspaceDescription(input.workspace, input.attemptStatusMap, input.diffTotalsByWorkspaceId),
    icon: "GitBranch",
    collapsible: sessions.length > 0,
    contextMenuActions: input.resolveWorkspaceContextMenuActions?.(input.workspace),
    resource: createNavigationResource({
      projectId: input.projectId,
      ticketShorthand: input.ticketShorthand,
      id: `workspace:${input.workspace.id}`,
      label,
      metadata: { action: "select-workspace", workspaceShorthand: input.workspace.shorthand },
    }),
    children: sessions.map((session) =>
      createSessionNode({
        projectId: input.projectId,
        resolveSessionContextMenuActions: input.resolveSessionContextMenuActions,
        ticketShorthand: input.ticketShorthand,
        workspaceShorthand: input.workspace.shorthand,
        session,
      }),
    ),
  };
};

export const createTicketDetailsNavigationSections = (
  input: CreateTicketDetailsNavigationSectionsInput,
): TreeViewSection[] => [
  {
    id: "planning",
    nodes: [
      {
        id: "planning",
        label: "Planning",
        icon: "ArrowLeft",
        resource: createNavigationResource({
          projectId: input.projectId,
          ticketShorthand: input.ticketShorthand,
          id: "planning",
          label: "Planning",
          metadata: { action: "select-planning" },
        }),
      },
    ],
  },
  {
    id: "files",
    label: "Files",
    nodes: [createTicketContentFile(), ...input.files].map((file) =>
      createFileNode({
        projectId: input.projectId,
        ticketShorthand: input.ticketShorthand,
        contextMenuActions: file.id === TICKET_CONTENT_ITEM_ID ? input.resolveTicketContextMenuActions?.() : undefined,
        file,
      }),
    ),
  },
  ...(input.subTickets.length > 0
    ? [
        {
          id: "sub-tickets",
          label: "Sub-tickets",
          nodes: input.subTickets.map((subTicket) =>
            createSubTicketNode({ projectId: input.projectId, ticketShorthand: input.ticketShorthand, subTicket }),
          ),
        },
      ]
    : []),
  {
    id: "workspaces",
    label: "Workspaces",
    actions: [{ id: "new-workspace", label: "New workspace", icon: "Plus", run: input.onCreateWorkspace }],
    nodes: input.workspaces.map((workspace) => createWorkspaceNode({ ...input, workspace })),
  },
];

export const openTicketDetailsNavigationResource = (
  resource: ResourceRef,
  handlers: {
    onSelectFile: (fileId: string) => void;
    onSelectPlanning: () => void;
    onSelectSession: (workspaceShorthand: string, sessionId: string) => void;
    onSelectSubTicket: (ticketShorthand: string) => void;
    onSelectWorkspace: (workspaceShorthand: string) => void;
  },
) => {
  if (resource.metadata?.action === "select-file" && typeof resource.metadata.fileId === "string") {
    handlers.onSelectFile(resource.metadata.fileId);
  }
  if (resource.metadata?.action === "select-planning") {
    handlers.onSelectPlanning();
  }
  if (resource.metadata?.action === "select-sub-ticket" && typeof resource.metadata.ticketShorthand === "string") {
    handlers.onSelectSubTicket(resource.metadata.ticketShorthand);
  }
  if (resource.metadata?.action === "select-workspace" && typeof resource.metadata.workspaceShorthand === "string") {
    handlers.onSelectWorkspace(resource.metadata.workspaceShorthand);
  }
  if (
    resource.metadata?.action === "select-session" &&
    typeof resource.metadata.workspaceShorthand === "string" &&
    typeof resource.metadata.sessionId === "string"
  ) {
    handlers.onSelectSession(resource.metadata.workspaceShorthand, resource.metadata.sessionId);
  }
};
