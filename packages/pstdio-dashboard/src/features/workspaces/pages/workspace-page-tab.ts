export const WORKSPACE_PAGE_TABS = ["changes", "checks"] as const;

export type WorkspacePageTab = (typeof WORKSPACE_PAGE_TABS)[number];

export const normalizeWorkspacePageTab = (value: unknown): WorkspacePageTab =>
  value === "checks" ? "checks" : "changes";
