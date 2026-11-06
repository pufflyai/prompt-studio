import { contributionRefId, workbenchPages, workspacePages } from "@pstdio/sdk/extensions";
import type { WorkbenchModuleContext } from "@pstdio/workbench";
import { createDashboardSessions } from "@/modules/sessions/data/dashboard-sessions";
import { buildWorkspaceSessionsSections } from "@/modules/sessions/sessions-sidenav-tree";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";

export const registerWorkspaceSessionNavigation = (ctx: WorkbenchModuleContext) => {
  for (const page of [
    workspacePages.workspace,
    workspacePages.overview,
    workspacePages.history,
    workbenchPages.workspace,
  ]) {
    ctx.navigationTrees.registerContribution({
      id: `dashboard.sessions.workspace-level.${contributionRefId(page)}`,
      owner: { kind: "page", id: contributionRefId(page), extensionId: page.extensionId },
      sourceExtensionId: "pstdio",
      declarationIndex: 0,
      getSections: ({ resource }) =>
        resource?.type === "workspace"
          ? buildWorkspaceSessionsSections(createDashboardSessions(getDashboardSelectedProjectId(ctx)), resource)
          : [],
    });
  }
};
