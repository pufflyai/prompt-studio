import { contributionRefId, type PageRef, type RelatedResourceOpening, resourceKey } from "@pstdio/sdk/extensions";
import type {
  NavigationTarget,
  NavigationTargetPanel,
  ResourceRef,
  WorkbenchModuleContext,
  WorkbenchRegion,
} from "../../core";
import { resourceMatchesConstraint } from "../../core/shared/contributions/reference-id";
import { relatedResourcePageKey } from "./related-resource-page-key";

const findPage = (ctx: WorkbenchModuleContext, ref: PageRef) =>
  ctx.pages.listPages().find((page) => page.ref.id === ref.id && page.ref.extensionId === ref.extensionId);
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
  const reveal = (region: WorkbenchRegion) => {
    if (region === "side" || region === "secondary") ctx.shell.setRegionOpen(region, true);
    else ctx.layout.setRegionVisible(region, true);
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
    reveal(region);
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
    reveal(region);
    return true;
  };
  const open = (target: NavigationTarget, source: ResourceRef, options: RelatedResourceOpening) => {
    if (target.kind === "compound") {
      let opened = false;
      for (const item of target.targets) if (open(item, source, options)) opened = true;
      return opened;
    }
    if (target.kind !== "panel" && target.kind !== "page") return false;
    const resource = target.resource;
    if (!resource) return false;
    const existing = Object.values(ctx.layout.getLayout().regions)
      .flatMap((region) => region.widgets.map((panel) => ({ region: region.id, panel })))
      .find(({ panel }) => panel.resource && resourceKey(panel.resource) === resourceKey(resource));
    if (existing) {
      reveal(existing.region);
      return true;
    }
    if (target.kind === "panel") return Boolean(openPanel(target, resource, source, options));
    const viewId = pagePreviewView(ctx, target.page, resource);
    return viewId ? openView(viewId, resource, source, options) : false;
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
    closePagePreviews(sourceKey: string) {
      // Only tabs this opener created belong to the page's temporary context.
      // Existing tabs and tabs the user repurposed do not belong to this page.
      const previews = Object.values(ctx.layout.getLayout().regions)
        .flatMap((region) => region.widgets)
        .filter((panel) => panel.relatedSource === sourceKey && panel.tabRetention === "preview");
      for (const preview of previews) {
        // Closing one placement can reconcile the other outgoing tabs away.
        const panel = Object.values(ctx.layout.getLayout().regions)
          .flatMap((region) => region.widgets)
          .find((panel) => panel.widgetId === preview.widgetId);
        if (panel?.relatedSource === sourceKey && panel.tabRetention === "preview" && panel.placementIdentity)
          ctx.closePlacement(panel.placementIdentity);
      }
      return previews.map((panel) => panel.widgetId);
    },
    dispose() {
      unsubscribe();
      for (const projection of projections.values()) projection.dispose();
    },
  };
};
