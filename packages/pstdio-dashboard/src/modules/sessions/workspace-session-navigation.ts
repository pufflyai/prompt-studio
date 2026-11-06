import { contributionRefId, workbenchPages, workspacePages } from "@pstdio/sdk/extensions";
import type { WorkbenchModuleContext } from "@pstdio/workbench";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { createDashboardSessions } from "./data/dashboard-sessions";
import { buildWorkspaceSessionsSections } from "./sessions-sidenav-tree";

export const registerWorkspaceSessionNavigation = (ctx: WorkbenchModuleContext) => {
  for (const page of [
    workspacePages.workspace,
    workspacePages.overview,
    workspacePages.history,
    workbenchPages.workspace,
  ]) {
    ctx.navigationTrees.registerContribution({
      id: `dashboard.sessions.workspace-level.${contributionRefId(page)}`,
      owner: { kind: "page", id: contributionRefId(page), extensionId: page.extensionId ?? "pstdio" },
      sourceExtensionId: "pstdio",
      declarationIndex: 0,
      getSections: ({ resource }) =>
        resource?.type === "workspace"
          ? buildWorkspaceSessionsSections(createDashboardSessions(getDashboardSelectedProjectId(ctx)), resource)
          : [],
    });
  }
};
