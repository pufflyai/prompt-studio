import {
  type DashboardRows,
  isDashboardProjectRow,
  isVisibleDashboardRow,
  readDashboardRows,
} from "@/shared/sync/dashboard-rows";

export interface DashboardWorkspaceOption {
  id: string;
  title: string;
  shorthand: string;
  branch: string | null;
  isDefault: boolean;
  updatedAt: string;
}

const toWorkspaceOption = (workspace: DashboardRows["workspaces"][number]): DashboardWorkspaceOption => ({
  id: workspace.id,
  title: (workspace.name as string | null) ?? (workspace.workspace_shorthand as string),
  shorthand: workspace.workspace_shorthand as string,
  branch: (workspace.branch as string | null) ?? null,
  isDefault: Boolean(workspace.is_default),
  updatedAt: (workspace.updated_at as string) ?? (workspace.created_at as string) ?? "",
});

// The default workspace (root repo) is pinned first; the rest follow newest-first.
export const createDashboardWorkspaceOptions = (projectId?: string) =>
  readDashboardRows()
    .workspaces.filter((workspace) => isVisibleDashboardRow(workspace) && isDashboardProjectRow(workspace, projectId))
    .map(toWorkspaceOption)
    .sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
