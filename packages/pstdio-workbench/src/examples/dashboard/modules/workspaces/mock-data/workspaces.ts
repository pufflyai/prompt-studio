import type { Diff } from "@pstdio/ui/diff";

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
