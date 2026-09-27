import type { WorkspaceProviderDescriptor } from "@pstdio/sdk/api";
import { workbenchPages } from "@pstdio/sdk/extensions";
import type { TreeNode, WorkbenchModuleContext } from "@pstdio/workbench";
import { QueryObserver } from "@tanstack/react-query";
import { dashboardQueryClient } from "@/lib/query-client";
import { subscribeCollections } from "@/lib/sync/collections";
import { dashboardCommandIds } from "@/shared/app/commands";
import { getDashboardSelectedProjectId, subscribeDashboardSelectedProject } from "@/shared/app/project-context";
import { dashboardViews } from "@/shared/app/resources";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { registerDashboardNavigationContribution } from "@/shared/workbench/dashboard-navigation-contribution";
import { invalidateWorkspaceProviders, workspaceProvidersQueryOptions } from "@/shared/workspaces/workspace-providers";

export const workspaceNavigationNode = (providers: readonly WorkspaceProviderDescriptor[]) =>
  ({
    id: dashboardViews.workspaces.id,
    label: "Workspaces",
    icon: dashboardViews.workspaces.icon,
    canHide: true,
    hiddenByDefault: true,
    commandId: dashboardCommandIds.openWorkspaces,
    target: { kind: "page", page: workbenchPages.workspaces },
    actions: providers.length
      ? [
          {
            id: "new-workspace",
            label: "New workspace",
            icon: "Plus",
            commandId: dashboardCommandIds.createWorkspace,
          },
        ]
      : [],
  }) satisfies TreeNode;

export const registerWorkspaceSidenavContributions = (ctx: WorkbenchModuleContext) => {
  const options = () => workspaceProvidersQueryOptions(getDashboardSelectedProjectId(ctx));
  const providers = new QueryObserver(dashboardQueryClient, options());
  const refreshNavigation = () => {
    if (ctx.views.getView(dashboardWidgetIds.dashboardSidenav)) {
      ctx.views.refreshView(dashboardWidgetIds.dashboardSidenav);
    }
  };
  // Catalog discovery has its own query lifetime. A slow request must not hold the navigation renderer open.
  const unsubscribeProviders = providers.subscribe(refreshNavigation);
  const contributions = registerDashboardNavigationContribution(ctx, {
    id: "dashboard.workspaces.project-nav",
    modes: ["project"],
    getSections: () => {
      const result = providers.getCurrentResult();
      return [{ id: "navigation.root", nodes: [workspaceNavigationNode(result.isError ? [] : (result.data ?? []))] }];
    },
  });
  const unsubscribeProject = subscribeDashboardSelectedProject(ctx, () => {
    providers.setOptions(options());
    refreshNavigation();
  });
  const unsubscribeExtensions = subscribeCollections((change) => {
    const projectId = getDashboardSelectedProjectId(ctx);
    const defaultWorkspaceChanged =
      change?.table === "workspaces" &&
      change.changes.some(({ value, previousValue }) =>
        [value, previousValue].some((row) => row?.project_id === projectId && row?.is_default === true),
      );
    if (
      !defaultWorkspaceChanged &&
      change?.table !== "extension_instances" &&
      change?.table !== "installed_extension_sources"
    )
      return;
    void invalidateWorkspaceProviders(dashboardQueryClient, projectId);
  });
  return {
    dispose() {
      unsubscribeExtensions();
      unsubscribeProject();
      unsubscribeProviders();
      for (const contribution of contributions) contribution.dispose();
    },
  };
};
