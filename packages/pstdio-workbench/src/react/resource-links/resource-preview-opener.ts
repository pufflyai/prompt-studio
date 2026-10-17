import { contributionRefId, type PageRef, type PlacementIdentity, resourceKey } from "@pstdio/sdk/extensions";
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

// Owner views render related previews without changing the routed parent page.
export const createResourcePreviewOpener = (ctx: WorkbenchModuleContext) => {
  const projections = new Map<string, { viewId: string; dispose(): void }>();
  const replacesSource = (region: WorkbenchRegion, source: ResourceRef) =>
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
    region: "side" | "secondary" = "side",
  ) => {
    if (!ctx.views.getView(viewId) || replacesSource(region, source)) return false;
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
    ctx.shellPlacements.openPlacement({ placementId: id, resource, title: resource.label, open: "preview" });
    return true;
  };
  const activatePlacement = (identity: PlacementIdentity) => {
    const opened = ctx.layout
      .listPanelInstances()
      .find(
        (entry) =>
          entry.placementIdentity && placementIdentityKey(entry.placementIdentity) === placementIdentityKey(identity),
      );
    if (opened) ctx.layout.activatePanel(opened.instanceId);
  };
  const openShellPanel = (id: string, resource: ResourceRef, source: ResourceRef) => {
    const placement = ctx.shellPlacements.getPlacement(id);
    if (placement?.item.kind !== "binding") return false;
    if (placement.item.binding.cardinality === "one")
      return openView(contributionRefId(placement.item.binding.view), resource, source);
    if (replacesSource(placement.region, source)) return false;
    ctx.shellPlacements.openPlacement({ placementId: id, resource, open: "preview", title: resource.label });
    return true;
  };
  const openModePanel = (
    panel: Extract<NavigationTargetPanel["panel"], { kind: "placement" }>,
    resource: ResourceRef,
    source: ResourceRef,
  ) => {
    const placement = ctx.modePlacements.getPlacement(panel);
    if (placement?.item.kind !== "binding") return false;
    if (placement.modeId !== ctx.modes.getActiveModeId() || placement.item.binding.cardinality === "one")
      return openView(contributionRefId(placement.item.binding.view), resource, source);
    if (replacesSource(placement.region, source)) return false;
    const identity = ctx.modePlacements.openPlacement({ panel, resource, open: "preview" });
    activatePlacement(identity);
    return true;
  };
  const openPanel = (target: NavigationTargetPanel, resource: ResourceRef, source: ResourceRef) => {
    const panel = target.panel;
    if (panel.kind === "shell-placement") return openShellPanel(panel.id, resource, source);
    if (panel.kind === "placement") return openModePanel(panel, resource, source);
    const slot = findPage(ctx, panel.page)?.slots.find((slot) => slot.id === panel.id);
    return (
      slot?.item.kind === "binding" &&
      openView(
        contributionRefId(slot.item.binding.view),
        resource,
        source,
        slot.region === "secondary" ? "secondary" : "side",
      )
    );
  };
  const open = (target: NavigationTarget, source: ResourceRef) => {
    if (target.kind === "compound") {
      let opened = false;
      for (const item of target.targets) if (open(item, source)) opened = true;
      return opened;
    }
    if (target.kind !== "panel" && target.kind !== "page") return false;
    const resource = target.resource;
    if (!resource) return false;
    const existing = ctx.layout
      .listPanelInstances()
      .find((panel) => panel.resource && resourceKey(panel.resource) === resourceKey(resource));
    if (existing) {
      ctx.layout.activatePanel(existing.instanceId);
      return true;
    }
    if (target.kind === "panel") return Boolean(openPanel(target, resource, source));
    const viewId = pagePreviewView(ctx, target.page, resource);
    return viewId ? openView(viewId, resource, source) : false;
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
