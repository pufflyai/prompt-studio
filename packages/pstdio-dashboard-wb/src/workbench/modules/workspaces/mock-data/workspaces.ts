import type { Diff } from "@pstdio/ui";
import type { ResourceRef } from "pstdio-workbench/core";
import { createResource } from "../../../shared/mock-data/resources";

interface DashboardWorkspaceSession {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
  workspaceId: string;
  workspaceShorthand: string;
  resource: ResourceRef;
}

export interface DashboardWorkspace {
  id: string;
  title: string;
  shorthand: string;
  type: "worktree" | "current_branch";
  status: { name: string; color: string };
  sessionStatus: string;
  additions: number;
  deletions: number;
  updatedAt: string;
  worktreePath: string | null;
  setupError: string | null;
  resource: ResourceRef;
  sessions: DashboardWorkspaceSession[];
}

const createSession = (
  workspace: Pick<DashboardWorkspace, "id" | "shorthand">,
  session: Omit<DashboardWorkspaceSession, "workspaceId" | "workspaceShorthand" | "resource">,
) => ({
  ...session,
  workspaceId: workspace.id,
  workspaceShorthand: workspace.shorthand,
  resource: createResource("session", session.id, session.title, "MessageCircle"),
});

const createWorkspace = (workspace: Omit<DashboardWorkspace, "resource" | "sessions">) => ({
  ...workspace,
  resource: createResource("workspace", workspace.id, workspace.title, "GitBranch"),
  sessions: [] as DashboardWorkspaceSession[],
});

const dashboardShellWorkspace = createWorkspace({
  id: "dashboard-shell",
  title: "Dashboard workbench shell",
  shorthand: "A1",
  type: "worktree",
  status: { name: "Running", color: "blue" },
  sessionStatus: "in_progress",
  additions: 148,
  deletions: 37,
  updatedAt: "2026-05-22T08:42:00Z",
  worktreePath: "../prompt-studio-dashboard-shell",
  setupError: null,
});

const dashboardSessionsWorkspace = createWorkspace({
  id: "sessions-mode",
  title: "Sessions mode extraction",
  shorthand: "B2",
  type: "worktree",
  status: { name: "Review", color: "purple" },
  sessionStatus: "awaiting_input",
  additions: 64,
  deletions: 12,
  updatedAt: "2026-05-21T16:20:00Z",
  worktreePath: "../prompt-studio-sessions-mode",
  setupError: null,
});

const dashboardChecksWorkspace = createWorkspace({
  id: "checks-widgets",
  title: "Checks and changes widgets",
  shorthand: "C3",
  type: "current_branch",
  status: { name: "Queued", color: "yellow" },
  sessionStatus: "queued",
  additions: 21,
  deletions: 8,
  updatedAt: "2026-05-20T11:15:00Z",
  worktreePath: null,
  setupError: null,
});

dashboardShellWorkspace.sessions = [
  createSession(dashboardShellWorkspace, {
    id: "session-shell-review",
    title: "Review dashboard shell migration",
    status: "in_progress",
    updatedAt: "2026-05-22T08:55:00Z",
  }),
  createSession(dashboardShellWorkspace, {
    id: "session-sidebar-parity",
    title: "Match workspace sidebar behavior",
    status: "completed",
    updatedAt: "2026-05-22T07:10:00Z",
  }),
];

dashboardSessionsWorkspace.sessions = [
  createSession(dashboardSessionsWorkspace, {
    id: "session-list-mode",
    title: "Move sessions into a dedicated mode",
    status: "awaiting_input",
    updatedAt: "2026-05-21T16:40:00Z",
  }),
];

dashboardChecksWorkspace.sessions = [
  createSession(dashboardChecksWorkspace, {
    id: "session-widget-tabs",
    title: "Promote changes and checks to widgets",
    status: "queued",
    updatedAt: "2026-05-20T11:30:00Z",
  }),
];

export const dashboardWorkspaces = [
  dashboardShellWorkspace,
  dashboardSessionsWorkspace,
  dashboardChecksWorkspace,
] satisfies DashboardWorkspace[];

export const dashboardSessions = dashboardWorkspaces.flatMap((workspace) => workspace.sessions);

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
