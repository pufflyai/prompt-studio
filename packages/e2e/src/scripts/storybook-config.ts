export const sharedStorybooks = [
  {
    packageName: "ui",
    probeStoryId: "patterns-editors-mermaid-renderer--default",
    urlEnvironmentVariable: "E2E_STORYBOOK_UI_URL",
  },
  {
    packageName: "pstdio-dashboard",
    probeStoryId: "dashboard-sidenav--workspace-resource",
    urlEnvironmentVariable: "E2E_STORYBOOK_DASHBOARD_URL",
  },
  {
    packageName: "pstdio-workbench",
    probeStoryId: "pstdio-workbench-reference-core-api-visual-states--page-composition",
    urlEnvironmentVariable: "E2E_STORYBOOK_WORKBENCH_URL",
  },
] as const;

export type StorybookPackageName = (typeof sharedStorybooks)[number]["packageName"];
