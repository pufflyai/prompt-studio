import type { AnchorId, ResourceRef, WorkbenchModuleContext, WorkbenchPanelInstance } from "@pstdio/workbench";
import { resolveAnchorRegion } from "@pstdio/workbench";
import { selectDashboardNavigationResource } from "@/shared/app/navigation-state";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";

export interface RegisterResourceRouteInput {
  id: string;
  // Which resources this route opens (root and/or detail of a single kind family).
  match: (resource: ResourceRef) => boolean;
  mode: string;
  panelId: string;
  surface?: AnchorId;
  priority?: number;
  // Every dashboard primary route needs a selected project; default true sends a
  // project-less open to project-selection instead of opening into an empty project.
  requiresProject?: boolean;
  title?: (resource: ResourceRef) => string | undefined;
  // Side effects (breadcrumb, sidenav sync, remember/forget). Runs after mode activation,
  // before placement. It receives the domain resource but cannot change navigable identity —
  // the route always places the resource it was handed, so root can never become a detail.
  beforeOpen?: (input: { resource: ResourceRef }) => void;
  // Side effects that depend on the primary placement/resource being current.
  afterOpen?: (input: { resource: ResourceRef; placement: WorkbenchPanelInstance }) => void;
}

// A mode-aware primary resource route. It owns the mechanical navigation contract so modules
// cannot reintroduce wrapper-history, tab accumulation, or root/detail fallback bugs: it
// activates the route mode, opens the DOMAIN resource into the route's surface with
// replaceActive forwarded (so history replay replaces in place), and runs side-effect hooks
// that cannot replace navigable identity.
export const registerResourceRoute = (ctx: WorkbenchModuleContext, input: RegisterResourceRouteInput) => {
  const region = resolveAnchorRegion(input.surface ?? "primary");

  return ctx.resources.registerPresenter({
    id: input.id,
    priority: input.priority ?? 1000,
    canOpen: input.match,
    open: (resource, openInput) => {
      if ((input.requiresProject ?? true) && !getDashboardSelectedProjectId(ctx)) {
        ctx.navigator.commitContext({ modeId: "project-selection", resource: null });
        return ctx.layout.getActivePanel("overlay")!;
      }

      selectDashboardNavigationResource(ctx, resource, { modeId: input.mode });
      input.beforeOpen?.({ resource });

      const placement = ctx.layout.openPanel(input.panelId, {
        strategy: openInput.replaceActive ? { kind: "replace-active" } : { kind: "persistent" },
        resource,
        region,
        title: input.title?.(resource) ?? resource.label,
      });
      return placement;
    },
    afterOpen: (resource, placement) => input.afterOpen?.({ resource, placement }),
  });
};
