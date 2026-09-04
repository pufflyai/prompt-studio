import {
  type NavigationTargetPage,
  type PageLocation,
  type PageRef,
  type ResourceRef as PageResourceRef,
  workbenchPages,
} from "@pstdio/sdk/extensions";
import type { ResourceRef, WorkbenchModuleContext } from "@pstdio/workbench";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";

export const toPageResource = (resource: ResourceRef): PageResourceRef => ({
  type: resource.kind,
  id: resource.id ?? resource.uri,
  label: resource.label,
  metadata: resource.metadata as PageResourceRef["metadata"],
});

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
  const result = ctx.pageLocations.navigate({
    kind: "page",
    page: input.page,
    ...(input.resource ? { resource: toPageResource(input.resource) } : {}),
    ...(input.parent ? { parent: input.parent } : {}),
    ...(input.open ? { open: input.open } : {}),
  });
  if (!result.ok) throw new Error(result.diagnostic.message);
  return result.location;
};

export const openSessionsPage = (ctx: WorkbenchModuleContext, resource?: ResourceRef) =>
  navigateDashboardPage(ctx, { page: workbenchPages.sessions, ...(resource ? { resource } : {}) });

export const openWorkspacesPage = (
  ctx: WorkbenchModuleContext,
  resource?: ResourceRef,
  parent?: NavigationTargetPage,
) =>
  navigateDashboardPage(ctx, {
    page: workbenchPages.workspaces,
    ...(resource ? { resource } : {}),
    ...(parent ? { parent } : {}),
  });
