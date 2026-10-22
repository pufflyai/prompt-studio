import { contributionRefId, type PageRef, type RelatedResourceOpening, resourceKey } from "@pstdio/sdk/extensions";
import type {
  NavigationTarget,
  NavigationTargetPanel,
  ResourceRef,
  WorkbenchModuleContext,
  WorkbenchRegion,
} from "../../core";
import { isWorkbenchModePanelAvailable } from "../../core/registries/modes/mode-layout";
import { resourceMatchesConstraint } from "../../core/shared/contributions/reference-id";
import { createRelatedPanelLifetime } from "./related-panel-lifetime";
import { relatedResourcePageKey } from "./related-resource-page-key";

const findPage = (ctx: WorkbenchModuleContext, ref: PageRef) =>
  ctx.pages.listPages().find((page) => page.ref.id === ref.id && page.ref.extensionId === ref.extensionId);
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
  return slot?.item.kind === "binding" ? contributionRefId(slot.item.binding.view) : contributionRefId(page.main.empty);
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
  const openView = (viewId: string, resource: ResourceRef, source: ResourceRef, options: RelatedResourceOpening) => {
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
  ) => {
    const panel = target.panel;
    const { region, open = "preview" } = options;
    if (panel.kind === "page-slot") {
      const slot = findPage(ctx, panel.page)?.slots.find((slot) => slot.id === panel.id);
      return (
        slot?.item.kind === "binding" && openView(contributionRefId(slot.item.binding.view), resource, source, options)
      );
    }
    const placement =
      panel.kind === "shell-placement"
        ? ctx.shellPlacements.getPlacement(panel.id)
        : ctx.modePlacements.getPlacement(panel);
    if (placement?.item.kind !== "binding") return false;
    const viewId = contributionRefId(placement.item.binding.view);
    const inActiveMode =
      panel.kind === "shell-placement" || ("modeId" in placement && placement.modeId === ctx.modes.getActiveModeId());
    if (placement.item.binding.cardinality === "one" || placement.region !== region || !inActiveMode)
      return openView(viewId, resource, source, options);
    if (open === "preview" && replacesSource(region, source)) return false;
    if (panel.kind === "shell-placement")
      ctx.shellPlacements.openPlacement({
        placementId: panel.id,
        resource,
        open,
        title: resource.label,
        activate: false,
        relatedSource: relatedResourcePageKey(ctx),
      });
    else ctx.modePlacements.openPlacement({ panel, resource, open, relatedSource: relatedResourcePageKey(ctx) });
    return true;
  };
  const present = (
    target: Extract<NavigationTarget, { kind: "page" | "panel" }>,
    resource: ResourceRef,
    source: ResourceRef,
    options: RelatedResourceOpening,
  ) => {
    if (target.kind === "panel") return Boolean(openPanel(target, resource, source, options));
    const viewId = pagePreviewView(ctx, target.page, resource);
    return viewId ? openView(viewId, resource, source, options) : false;
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
