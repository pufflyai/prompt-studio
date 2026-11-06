import {
  type NavigationTargetPage,
  type PageLocation,
  type PageRef,
  workbenchPages,
  workspacePages,
} from "@pstdio/sdk/extensions";
import type { ResourceRef, WorkbenchModuleContext } from "@pstdio/workbench";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { dashboardExtensionsPage } from "@/shared/app/resources";
import { canonicalDashboardPageTarget } from "@/shared/extensions/resource-identity";
export const pageTargetFromLocation = (location: PageLocation): NavigationTargetPage => ({
  kind: "page",
  page: location.page,
  ...(location.resource ? { resource: location.resource } : {}),
  ...(location.section ? { section: location.section } : {}),
  ...(location.parent ? { parent: pageTargetFromLocation(location.parent) } : {}),
});
interface NavigateDashboardPageInput {
  page: PageRef;
  resource?: ResourceRef;
  parent?: NavigationTargetPage;
  open?: NavigationTargetPage["open"];
}
export const navigateDashboardPage = (ctx: WorkbenchModuleContext, input: NavigateDashboardPageInput) => {
  const projectId = getDashboardSelectedProjectId(ctx);
  if (!projectId) throw new Error("Cannot navigate to a dashboard page without a selected project");
  ctx.pageLocations.setProject(projectId);
  const result = ctx.pageLocations.navigate(
    canonicalDashboardPageTarget(
      {
        kind: "page",
        page: input.page,
        ...(input.resource ? { resource: input.resource } : {}),
        ...(input.parent ? { parent: input.parent } : {}),
        ...(input.open ? { open: input.open } : {}),
      },
      projectId,
    ),
  );
  if (!result.ok) throw new Error(result.diagnostic.message);
  return result.location;
};
export const openSessionsPage = (ctx: WorkbenchModuleContext, resource?: ResourceRef) => {
  let page: PageRef = workbenchPages.sessions;
  if (resource?.type === "session") page = workbenchPages.session;
  if (resource?.type === "session-draft") page = workbenchPages.newSession;
  return navigateDashboardPage(ctx, {
    page,
    ...(resource ? { resource } : {}),
  });
};
export const workspacePageForResource = (resource?: ResourceRef) => {
  if (!resource) return workspacePages.list;
  if (resource.device || resource.metadata?.workspaceReadOnly === true) return workspacePages.history;
  if (resource.metadata?.workspaceExecutionKind === "remote" || resource.metadata?.workspaceSupportsFiles === false)
    return workspacePages.overview;
  if (resource.metadata?.workspaceIsDefault === true || resource.metadata?.workspaceSupportsDiff === false)
    return workspacePages.files;
  return workspacePages.workspace;
};
export const openWorkspacesPage = (
  ctx: WorkbenchModuleContext,
  resource?: ResourceRef,
  parent?: NavigationTargetPage,
) =>
  navigateDashboardPage(ctx, {
    page: workspacePageForResource(resource),
    ...(resource ? { resource } : {}),
    ...(parent ? { parent } : {}),
  });

export const openExtensionsPage = (ctx: WorkbenchModuleContext) =>
  navigateDashboardPage(ctx, { page: dashboardExtensionsPage });
