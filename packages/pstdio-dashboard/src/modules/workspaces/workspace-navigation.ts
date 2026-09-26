import type { WorkspaceProviderDescriptor } from "@pstdio/sdk/api";
import { workbenchPages } from "@pstdio/sdk/extensions";
import type { TreeNode, WorkbenchModuleContext } from "@pstdio/workbench";
import { dashboardCommandIds } from "@/shared/app/commands";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { dashboardViews } from "@/shared/app/resources";
import { registerDashboardNavigationContribution } from "@/shared/workbench/dashboard-navigation-contribution";
import { fetchWorkspaceProviders } from "@/shared/workspaces/workspace-providers";

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

export const registerWorkspaceSidenavContributions = (ctx: WorkbenchModuleContext) =>
  registerDashboardNavigationContribution(ctx, {
    id: "dashboard.workspaces.project-nav",
    modes: ["project"],
    getSections: async () => {
      const projectId = getDashboardSelectedProjectId(ctx);
      // Provider discovery must not prevent users from opening existing workspaces.
      // Each refresh needs its own read so it cannot reuse a request made before provider enablement.
      const providers = projectId ? await fetchWorkspaceProviders(projectId).catch(() => []) : [];
      return [{ id: "navigation.root", nodes: [workspaceNavigationNode(providers)] }];
    },
  });
