import {
  contributionRefId,
  type PageLocation,
  type PageRef,
  pagePlaceholderView,
  type RelatedResourceOpening,
  resourceKey,
  type ViewLocation,
} from "@pstdio/sdk/extensions";
import type {
  NavigationTarget,
  NavigationTargetPanel,
  ResourceRef,
  WorkbenchModuleContext,
  WorkbenchRegion,
} from "../../core";
import { getPageLocationPreparation } from "../../core/controllers/page-location/page-location-preparation";
import { isWorkbenchModePanelAvailable } from "../../core/registries/modes/mode-layout";
import { replacedPageSlot } from "../../core/registries/modes/placement-replacement";
import { resourceMatchesConstraint } from "../../core/shared/contributions/reference-id";
import { createRelatedPanelLifetime } from "./related-panel-lifetime";
import { relatedResourcePageKey } from "./related-resource-page-key";

const findPage = (ctx: WorkbenchModuleContext, ref: PageRef) =>
  ctx.pages.listPages().find((page) => page.ref.id === ref.id && page.ref.extensionId === ref.extensionId);
const resolvePanelReference = (ctx: WorkbenchModuleContext, panel: NavigationTargetPanel["panel"]) =>
  panel.kind === "page-slot" ? (replacedPageSlot(ctx.modePlacements, panel)?.ref ?? panel) : panel;
const findOpenResource = (ctx: WorkbenchModuleContext, resource: ResourceRef) =>
  Object.values(ctx.layout.getLayout().regions)
    .flatMap((region) => region.widgets.map((panel) => ({ region: region.id, panel })))
    .find(({ panel }) => panel.resource && resourceKey(panel.resource) === resourceKey(resource));
const pagePreviewView = (ctx: WorkbenchModuleContext, pageRef: PageRef, resource: ResourceRef) => {
  const page = findPage(ctx, pageRef);
  if (!page) return;
  if (page.main.kind === "view") return contributionRefId(page.main.view);
  const slot = page.slots.find(
    (slot) =>
      slot.region === "main" && slot.item.kind === "binding" && resourceMatchesConstraint(slot.item.binding, resource),
  );
  if (slot?.item.kind === "binding") return contributionRefId(slot.item.binding.view);
  const empty = pagePlaceholderView(page.main.empty);
  if (empty) return contributionRefId(empty);
};

// Owner views render related resources without changing the routed parent page.
export const createResourcePreviewOpener = (ctx: WorkbenchModuleContext) => {
  const panels = createRelatedPanelLifetime(ctx);
  const reveal = (region: WorkbenchRegion) => {
    if (region === "side" || region === "secondary") {
      if (!ctx.shell.getRegionState(region).open) ctx.shell.setRegionOpen(region, true);
    } else ctx.layout.setRegionVisible(region, true);
  };
  const projections = new Map<string, { viewId: string; dispose(): void }>();
  const replacesSource = (region: RelatedResourceOpening["region"], source: ResourceRef) =>
    ctx.layout
      .getLayout()
      .regions[region].widgets.some(
        (widget) =>
          widget.tabRetention === "preview" && widget.resource && resourceKey(widget.resource) === resourceKey(source),
      );
  const openView = (
    viewId: string,
    resource: ResourceRef,
    source: ResourceRef,
    options: RelatedResourceOpening,
    location?: ViewLocation,
  ) => {
    const { region, open = "preview" } = options;
    if (!ctx.views.getView(viewId) || (open === "preview" && replacesSource(region, source))) return false;
    const id = `workbench.related.${JSON.stringify([resource.extensionId, resource.type, viewId, region])}`;
    if (!ctx.shellPlacements.getPlacement(id)) {
      const registration = ctx.shellPlacements.registerPlacement({
        id,
        region,
        item: {
          kind: "binding",
          binding: {
            kinds: [{ kind: "resource-kind", id: resource.type, extensionId: resource.extensionId }],
            view: { kind: "view", id: viewId },
            cardinality: "many",
          },
        },
      });
      projections.set(id, { viewId, dispose: () => registration.dispose() });
    }
    ctx.shellPlacements.openPlacement({
      placementId: id,
      resource,
      location,
      title: resource.label,
      open,
      activate: false,
      relatedSource: relatedResourcePageKey(ctx),
    });
    return true;
  };
  const openPanel = (
    target: NavigationTargetPanel,
    resource: ResourceRef,
    source: ResourceRef,
    options: RelatedResourceOpening,
    location?: ViewLocation,
  ) => {
    const panel = resolvePanelReference(ctx, target.panel);
    const { region, open = "preview" } = options;
    if (panel.kind === "page-slot") {
      const slot = findPage(ctx, panel.page)?.slots.find((slot) => slot.id === panel.id);
      return (
        slot?.item.kind === "binding" &&
        openView(contributionRefId(slot.item.binding.view), resource, source, options, location)
      );
    }
    const placement =
      panel.kind === "shell-placement"
        ? ctx.shellPlacements.getPlacement(panel.id)
        : ctx.modePlacements.getPlacement(panel);
    if (placement?.item.kind !== "binding") return false;
    const inActiveMode = !("modeId" in placement) || placement.modeId === ctx.modes.getActiveModeId();
    if (!inActiveMode) return false;
    if (open === "preview" && replacesSource(region, source)) return false;
    const openIntent = placement.item.binding.cardinality === "many" ? open : undefined;
    const relatedSource = open === "pin" ? undefined : relatedResourcePageKey(ctx);
    if (panel.kind === "shell-placement")
      ctx.shellPlacements.openPlacement({
        placementId: panel.id,
        region,
        resource,
        location,
        open: openIntent,
        title: resource.label,
        activate: false,
        relatedSource,
      });
    else
      ctx.modePlacements.openPlacement({
        panel,
        region,
        resource,
        location,
        open: openIntent,
        relatedSource,
      });
    return true;
  };
  const present = (
    target: Extract<NavigationTarget, { kind: "page" | "panel" }>,
    resource: ResourceRef,
    source: ResourceRef,
    options: RelatedResourceOpening,
  ) => {
    if (target.kind === "panel") return Boolean(openPanel(target, resource, source, options));
    const page = findPage(ctx, target.page);
    if (!page) return false;
    let location: PageLocation;
    try {
      location = getPageLocationPreparation(ctx.pageLocations).resolve(target).location;
    } catch {
      return false;
    }
    const viewLocation: ViewLocation = {
      section: location.section,
      position: location.position,
      pageContext: { page: location.page, parent: location.parent, params: location.params },
    };
    if (page.panelView)
      return Boolean(openPanel({ kind: "panel", panel: page.panelView }, resource, source, options, viewLocation));
    const viewId = pagePreviewView(ctx, target.page, resource);
    return viewId ? openView(viewId, resource, source, options, viewLocation) : false;
  };
  const updateVisibility = (region: WorkbenchRegion, show: boolean, closed: boolean, resource: ResourceRef) => {
    if (!show) {
      if ((region === "side" || region === "secondary") && ctx.shell.getPanelPolicy(region).canClose)
        ctx.shell.setRegionOpen(region, false);
      return;
    }
    if (closed) {
      const panel = findOpenResource(ctx, resource)?.panel;
      if (panel) ctx.layout.setRegionActiveWidget(region, panel.widgetId);
      panels.claim(region, relatedResourcePageKey(ctx));
    }
    reveal(region);
  };
  const openResource = (
    target: Extract<NavigationTarget, { kind: "page" | "panel" }>,
    source: ResourceRef,
    options: RelatedResourceOpening,
    show: boolean,
  ) => {
    const resource = target.resource;
    if (!resource) return false;
    const existing = findOpenResource(ctx, resource);
    const region = existing?.region ?? options.region;
    const modeId = ctx.modes.getActiveModeId();
    if (
      !isWorkbenchModePanelAvailable(
        modeId ? ctx.modes.getMode(modeId) : undefined,
        region as "main" | "side" | "secondary",
      )
    )
      return false;
    const policy = ctx.shell.getPanelPolicy(region);
    if (!policy.provided || (!existing && !policy.acceptsTabs)) return false;
    show = show && (policy.open || policy.canOpen);
    // Capture visibility before placement reconciliation can reveal the panel.
    const closed = (region === "side" || region === "secondary") && !ctx.shell.getRegionState(region).open;
    if (!existing && !present(target, resource, source, options)) return false;
    updateVisibility(region, show, closed, resource);
    return true;
  };
  const open = (target: NavigationTarget, source: ResourceRef, options: RelatedResourceOpening, show = true) => {
    if (target.kind === "compound") {
      let opened = false;
      for (const item of target.targets) if (open(item, source, options, show)) opened = true;
      return opened;
    }
    if (target.kind !== "panel" && target.kind !== "page") return false;
    return panels.run(() => openResource(target, source, options, show));
  };
  const unsubscribe = ctx.views.store.subscribe(() => {
    for (const [id, projection] of projections) {
      if (ctx.views.getView(projection.viewId)) continue;
      projection.dispose();
      projections.delete(id);
    }
  });
  return {
    open,
    leavePage(sourceKey: string) {
      panels.run(() => panels.leave(sourceKey));
    },
    dispose() {
      panels.dispose();
      unsubscribe();
      for (const projection of projections.values()) projection.dispose();
    },
  };
};
