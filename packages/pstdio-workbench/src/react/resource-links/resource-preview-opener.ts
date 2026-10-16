import {
  contributionRefId,
  type PageRef,
  type PlacementIdentity,
  type RelatedResourceOpening,
  resourceKey,
} from "@pstdio/sdk/extensions";
import type {
  NavigationTarget,
  NavigationTargetPanel,
  ResourceRef,
  WorkbenchModuleContext,
  WorkbenchRegion,
} from "../../core";
import { placementIdentityKey } from "../../core/registries/layout/placement-reconciliation";
import { resourceMatchesConstraint } from "../../core/shared/contributions/reference-id";

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
    ctx.shellPlacements.openPlacement({ placementId: id, resource, title: resource.label, open });
    reveal(region);
    return true;
  };
  const activatePlacement = (identity: PlacementIdentity) => {
    const instance = ctx.layout
      .listPanelInstances()
      .find(
        (entry) =>
          entry.placementIdentity && placementIdentityKey(entry.placementIdentity) === placementIdentityKey(identity),
      );
    if (instance) ctx.layout.activatePanel(instance.instanceId);
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
      ctx.shellPlacements.openPlacement({ placementId: panel.id, resource, open, title: resource.label });
    else activatePlacement(ctx.modePlacements.openPlacement({ panel, resource, open }));
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
      ctx.layout.activatePanel(existing.panel.widgetId);
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
    dispose() {
      unsubscribe();
      for (const projection of projections.values()) projection.dispose();
    },
  };
};
