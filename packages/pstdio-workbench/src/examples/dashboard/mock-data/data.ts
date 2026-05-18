import type { Diff } from "@pstdio/ui";
import type { SessionMessage } from "@pstdio/ui/chat-ui";
import type { MenuPath, ResourceRef } from "../../../core";

export const dashboardHelpMenuPath = ["dashboardWorkbench", "help"] as const satisfies MenuPath;

export const dashboardNavigationTreeViewId = "dashboard-workbench.navigation";
export const dashboardSettingsNavigationTreeViewId = "dashboard-workbench.settings.navigation";
export const dashboardDataRendererStorageKey = "dashboard-workbench-example";
export const dashboardCollectionsProjectId = "dashboard-project";
const dashboardFavoriteScope = { scope: "project", projectId: dashboardCollectionsProjectId } as const;

export const dashboardWidgetIds = {
  header: "dashboard-workbench.header",
  tickets: "dashboard-workbench.tickets",
  workspaces: "dashboard-workbench.workspaces",
  workspace: "dashboard-workbench.workspace",
  workspacePage: "dashboard-workbench.workspace-page",
  workspaceList: "dashboard-workbench.workspace-list",
  sessions: "dashboard-workbench.sessions",
  extensionRoute: "dashboard-workbench.extension-route",
  settings: "dashboard-workbench.settings",
  status: "dashboard-workbench.status",
  session: "dashboard-workbench.session",
} as const;

const createResource = (kind: string, id: string, label: string, icon: string) =>
  ({
    kind,
    uri: `dashboard-workbench://${kind}/${id}`,
    id,
    label,
    icon,
    metadata: { favoriteScope: dashboardFavoriteScope },
  }) satisfies ResourceRef;

export const dashboardResources = {
  tickets: createResource("dashboard-view", "tickets", "Tickets", "KanbanSquare"),
  workspaces: createResource("dashboard-view", "workspaces", "Workspaces", "GitBranch"),
  sessions: createResource("dashboard-view", "sessions", "Sessions", "MessagesSquare"),
  lab: createResource("extension-route", "lab", "Lab", "FlaskConical"),
  repoHealth: createResource("extension-route", "repo-health", "Repo health", "GitBranch"),
  changelog: createResource("extension-route", "changelog", "Changelog", "Workflow"),
  settings: createResource("project-settings", "settings", "Project settings", "Settings"),
} as const;

export const dashboardSettingsResources = {
  agents: createResource("project-settings", "settings/agents", "Agents", "Bot"),
  repositories: createResource("project-settings", "settings/repositories", "Repositories", "GitBranch"),
  labSettings: createResource("project-settings", "settings/lab", "Lab settings", "FlaskConical"),
  auditLog: createResource("project-settings", "settings/audit-log", "Audit log", "ClipboardList"),
  repoHealth: createResource("project-settings", "settings/repo-health", "Repo health", "GitBranch"),
} as const;

export const dashboardTicketTags = [
  {
    name: "priority",
    label: "Priority",
    options: [
      { value: "high", label: "High", color: "red" },
      { value: "medium", label: "Medium", color: "yellow" },
      { value: "low", label: "Low", color: "gray" },
    ],
  },
  {
    name: "area",
    label: "Area",
    options: [
      { value: "workbench", label: "Workbench", color: "blue" },
      { value: "sessions", label: "Sessions", color: "purple" },
      { value: "infra", label: "Infra", color: "green" },
    ],
  },
];

export const dashboardStatusColumns = [
  { id: "backlog", label: "Backlog", color: "gray" },
  { id: "in-progress", label: "In progress", color: "blue" },
  { id: "review", label: "Review", color: "purple" },
  { id: "done", label: "Done", color: "green" },
];

const ticketRows = [
  {
    id: "PS-294",
    title: "Migrate dashboard primitives onto workbench shell",
    status: "in-progress",
    assignee: "Aure",
    priority: "high",
    area: "workbench",
    updatedAt: "2026-05-17T08:30:00Z",
    workspace: {
      shorthand: "A1",
      type: "worktree",
      status: { name: "Running", color: "blue", description: "Agent session is applying the workbench bridge." },
      sessionStatus: "in_progress",
      additions: 148,
      deletions: 37,
    },
  },
  {
    id: "PS-298",
    title: "Move project shell routes into workbench areas",
    status: "backlog",
    assignee: "Sam",
    priority: "medium",
    area: "workbench",
    updatedAt: "2026-05-16T16:15:00Z",
    workspace: {
      shorthand: "A2",
      type: "current_branch",
      status: { name: "Queued", color: "yellow", description: "Waiting for PS-294 to settle." },
      sessionStatus: "queued",
      additions: 0,
      deletions: 0,
    },
  },
  {
    id: "PS-201",
    title: "Add command palette quick actions",
    status: "review",
    assignee: "Nora",
    priority: "medium",
    area: "sessions",
    updatedAt: "2026-05-15T11:45:00Z",
    workspace: {
      shorthand: "B1",
      type: "worktree",
      status: { name: "Review", color: "purple", description: "Ready for reviewer pass." },
      sessionStatus: "awaiting_input",
      additions: 52,
      deletions: 14,
    },
  },
  {
    id: "PS-198",
    title: "Theme dashboard surfaces",
    status: "done",
    assignee: "Mika",
    priority: "low",
    area: "workbench",
    updatedAt: "2026-05-14T09:20:00Z",
    workspace: {
      shorthand: "C1",
      type: "worktree",
      status: { name: "Merged", color: "green", description: "Changes merged into main." },
      sessionStatus: "completed",
      additions: 81,
      deletions: 22,
    },
  },
];

export const dashboardTickets = ticketRows.map((ticket) => ({
  ...ticket,
  ticketId: ticket.id,
  statusColor: dashboardStatusColumns.find((column) => column.id === ticket.status)?.color,
  tags: [
    { name: "priority", value: ticket.priority },
    { name: "area", value: ticket.area },
  ],
  resource: createResource("ticket", ticket.id, `${ticket.id} ${ticket.title}`, "Ticket"),
  workspaceResource: createResource(
    "workspace",
    ticket.id,
    `${ticket.id} Attempt ${ticket.workspace.shorthand}`,
    "GitBranch",
  ),
}));

export const dashboardWorkspaceDiffs: Diff[] = [
  {
    change: "modified",
    oldPath: "packages/pstdio-dashboard/src/features/project/pages/project-shell.tsx",
    newPath: "packages/pstdio-dashboard/src/features/project/pages/project-shell.tsx",
    oldContent: `export const ProjectShell = () => {
  return <LegacyDashboardLayout />;
};
`,
    newContent: `export const ProjectShell = () => {
  return <WorkbenchProjectShell />;
};
`,
    additions: 3,
    deletions: 3,
  },
  {
    change: "added",
    newPath: "packages/pstdio-dashboard/src/features/workbench/dashboard-workbench.tsx",
    newContent: `export const DashboardWorkbench = () => {
  return <Workbench workbench={dashboardWorkbench} />;
};
`,
    additions: 3,
    deletions: 0,
  },
  {
    change: "modified",
    oldPath: "packages/pstdio-dashboard/src/features/sessions/components/session-attached-panel.tsx",
    newPath: "packages/pstdio-dashboard/src/features/sessions/components/session-attached-panel.tsx",
    oldContent: `onClick={() => setSessionModalState("bubble")}`,
    newContent: `onClick={() => workbench.sessionPanel.setMode("bubble")}`,
    additions: 1,
    deletions: 1,
  },
];

export const dashboardChangedFilePaths = [
  "packages/pstdio-dashboard/src/features/project/pages/project-shell.tsx",
  "packages/pstdio-dashboard/src/features/workbench/dashboard-workbench.tsx",
  "packages/pstdio-dashboard/src/features/sessions/components/session-attached-panel.tsx",
  "packages/pstdio-workbench/src/core/registries/layout/layout-model.ts",
];

export const dashboardChecks = [
  { id: "typecheck", label: "dashboard typecheck", status: "passed" },
  { id: "lint", label: "feature import isolation", status: "passed" },
  { id: "storybook", label: "workspace story smoke", status: "running" },
];

export const dashboardMockChatMessages: SessionMessage[] = [
  {
    id: "u1",
    role: "user",
    parts: [{ type: "text", text: "Walk me through the failures in the e2e suite." }],
  },
  {
    id: "a1",
    role: "assistant",
    parts: [
      { type: "reasoning", text: "Inspecting the latest run logs and grouping failures by signature." },
      {
        type: "tool",
        tool: "workbench",
        callId: "tool-1",
        actionType: "execute",
        status: "completed",
        state: {
          input: { command: "bun run test:e2e --reporter=list" },
          output:
            "Running 23 tests...\n  PASS tickets > drag and drop (1.2s)\n  FAIL workspaces > diff regenerates (8.4s)\n  FAIL sessions > follow-up ordering (4.1s)\n  FAIL tickets > flaky filter (2.0s)\n2 failed, 1 flaky\n",
        },
      },
      {
        type: "text",
        text: "Two of the failures share a teardown ordering bug; the third is a flaky filter. I have a patch ready. Want me to apply it?",
      },
    ],
  },
  {
    id: "u2",
    role: "user",
    parts: [{ type: "text", text: "Yes, ship the patch and re-run on CI." }],
  },
  {
    id: "a2",
    role: "assistant",
    parts: [
      {
        type: "tool",
        tool: "edit",
        callId: "tool-2",
        actionType: "write",
        status: "completed",
        state: {
          input: { path: "packages/e2e/src/setup/teardown.ts" },
          output: "Updated teardown order to await pending fetches before clearing mocks.",
        },
      },
      { type: "text", text: "Patch applied. CI is running, ETA ~6 minutes." },
    ],
  },
];
