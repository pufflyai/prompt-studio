import {
  createResourceBreadcrumbItems,
  type ResourceRef,
  type WorkbenchModuleContext,
  type WorkbenchPageContribution,
} from "@pstdio/workbench";
import { getDashboardSelectedProjectId } from "./project-context";

// Dashboard glue for the workbench page engine: per-page layout persistence scopes,
// breadcrumbs for extension pages, and the URL writer. The navigable location
// everywhere is `(page, resource?)`; this module makes the browser URL follow it.

const configuredWorkbenches = new WeakSet<object>();

const dashboardFurnitureRegions = [
  "nav",
  "activity",
  "sidenav-header",
  "sidenav",
  "side-header",
  "side-left-menu",
  "side",
  "side-right-menu",
  "status",
  "secondary",
] as const;

// The one computation of a slot-composed page's layout scope: per-page arrangement
// persists under it, and furniture regions the page leaves undeclared carry across
// the rotation so the sessions panel and terminals survive page switches. Both the
// page activation hook and the navigator's scope sync go through here, so a commit
// while a page is active can never rotate the bench back to a mode-view scope.
export const applyDashboardPageLayoutScope = (
  ctx: Pick<WorkbenchModuleContext, "context" | "layout" | "pages" | "panels">,
  page: WorkbenchPageContribution,
) => {
  const projectId = getDashboardSelectedProjectId(ctx);
  const scope = projectId ? `project/${projectId}/page/${page.id}` : undefined;
  const declared = new Set<string>(page.slots.map((slot) => slot.region));
  // Carrying replaces the incoming region with the live one, so it is only right when
  // the bench belongs to a page the user is already on: then their terminals and
  // sessions panel follow them to the next page. On boot no page is on the bench yet,
  // and carrying the startup defaults would overwrite the arrangement this page saved
  // last time — and then persist the loss.
  const switchingFromAPage = Boolean(ctx.pages.getActivePage());
  const carryRegionState = switchingFromAPage
    ? dashboardFurnitureRegions.filter((region) => !declared.has(region))
    : [];
  ctx.panels.setPersistenceScope(scope);
  ctx.layout.setPersistenceScope(scope, { carryRegionState });
  return ctx.layout.enteredWithPersistedLayout();
};

const pageUrl = (projectId: string, page: WorkbenchPageContribution, resource: ResourceRef | undefined) => {
  const segments = [`/projects/${encodeURIComponent(projectId)}`];
  if (page.urlPath) segments.push(page.urlPath);
  if (resource) {
    const custom = page.resourceUrlSegment?.(resource);
    if (custom) {
      segments.push(custom);
    } else if (!page.activate && resource.id) {
      segments.push(`${encodeURIComponent(resource.kind)}/${encodeURIComponent(resource.id)}`);
    }
  }
  return segments.join("/");
};

const writePageUrl = (
  ctx: WorkbenchModuleContext,
  page: WorkbenchPageContribution,
  location: { resource?: ResourceRef; reason: "activate" | "preview" | "pin" },
) => {
  if (typeof window === "undefined" || page.urlPath === undefined) return;
  const projectId = getDashboardSelectedProjectId(ctx);
  if (!projectId) return;
  const url = pageUrl(projectId, page, location.resource);
  if (window.location.pathname === url) return;
  // Page activations and pinned opens push a browser entry; preview swaps replace the
  // current one, mirroring workbench history.
  if (location.reason === "preview") window.history.replaceState(null, "", url);
  else window.history.pushState(null, "", url);
};

export const registerDashboardPageNavigation = (ctx: WorkbenchModuleContext) => {
  if (configuredWorkbenches.has(ctx.context.store)) return;
  configuredWorkbenches.add(ctx.context.store);

  ctx.pages.configureHooks({
    applyPageScope: (page) => {
      // A slot-composed page composes over the current bench. On a cold boot straight
      // into a page URL no mode is active yet, so the project bench (and its chrome,
      // like the sidenav) is established first.
      const activeMode = ctx.modes.getActiveModeId();
      if (!activeMode || activeMode === "project-selection") {
        ctx.navigator.commitContext({ modeId: "project", resource: null });
      }
      return applyDashboardPageLayoutScope(ctx, page);
    },
  });

  ctx.pages.onDidChangeLocation((location) => {
    const page = ctx.pages.registry.getPage(location.pageId);
    if (!page) return;
    // Host pages own their breadcrumbs through the native view flows; extension pages
    // build the trail here: the page crumb, then the active resource's hierarchy.
    if (!page.activate) {
      const pageCrumb = {
        title: page.title,
        icon: page.icon,
        onClick: () => void ctx.pages.activatePage(page.id),
      };
      const resourceItems = location.resource
        ? createResourceBreadcrumbItems(ctx.resources, location.resource, ctx.views)
        : [];
      ctx.breadcrumbs.setItems([pageCrumb, ...resourceItems]);
    }
    writePageUrl(ctx, page, location);
  });
};

// Opens a `(page, resource)` location for a resource that arrives without a page:
// native kinds keep their presenters, extension kinds land on the first page that
// binds them. Stored references (notifications, crumbs) route through this.
export const openDashboardResourceLocation = (ctx: WorkbenchModuleContext, resource: ResourceRef) => {
  const state = ctx.resources.store.getState();
  const hasPresenter = Object.values(state.presenters).some((presenter) => presenter.canOpen(resource));
  if (hasPresenter) return ctx.resources.openResource(resource, { replaceActive: true });

  const page = ctx.pages.registry.listPages().find((candidate) => candidate.binds.includes(resource.kind));
  if (page) return ctx.pages.activatePage(page.id, { resource });

  ctx.notifications.show({
    level: "warning",
    title: "Nowhere to open this item",
    message: `No page presents "${resource.kind}" resources.`,
  });
  return undefined;
};
