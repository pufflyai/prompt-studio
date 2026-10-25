import type { PageLocation, PageOpenIntent, PlacementIdentity } from "@pstdio/sdk/extensions";
import { type ResourceRef, resourceKey } from "@pstdio/sdk/extensions";
import type { WorkbenchLayout, WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import { placementIdentityKey } from "../../registries/layout/placement-reconciliation";
import type { WorkbenchModePlacementRegistry } from "../../registries/modes/mode-placement-registry";
import { replacedPageSlot } from "../../registries/modes/placement-replacement";
import { isPageContent } from "../../registries/pages/page-main";
import type { WorkbenchPageContribution, WorkbenchPageRegistryStoreState } from "../../registries/pages/page-registry";
import type { OwnedPlacementState } from "../../registries/placements/owned-placement-lifecycle";
import { getOwnedPlacementPreparation } from "../../registries/placements/owned-placement-preparation";
import { resourceMatchesConstraint } from "../../shared/contributions/reference-id";
import type { WorkbenchCore } from "../../workbench-core-types";
import { requirePanelOpen } from "../shell/panel-open-policy";

export const validatePagePanelView = (page: WorkbenchPageContribution, registry: WorkbenchModePlacementRegistry) => {
  if (!page.panelView) return;
  const placement = registry.getPlacement(page.panelView);
  if (!placement || placement.modeId !== page.modeId)
    throw new Error(`Page "${page.id}" requires a panel view in its mode`);
};

export const validatePageLanding = (
  core: WorkbenchCore,
  state: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>,
  identity: PlacementIdentity,
) => {
  const placement = state.placements.find(
    (placement) => placementIdentityKey(placement.identity) === placementIdentityKey(identity),
  );
  if (placement) requirePanelOpen(core, placement.region, { identity, modeId: state.activeModeId, proposed: state });
};

export const migratePagePanelView = (
  page: WorkbenchPageContribution,
  widget: WorkbenchWidgetPlacement,
  registry: WorkbenchModePlacementRegistry | undefined,
  layout?: WorkbenchLayout,
  referenceKey: (resource: ResourceRef) => string = resourceKey,
) => {
  const identity = widget.placementIdentity;
  const replacement =
    registry && identity?.kind === "page"
      ? replacedPageSlot(registry, { kind: "page-slot", page: page.ref, id: identity.slotId })
      : undefined;
  const panel = replacement?.ref ?? (isPageContent(page, identity) ? page.panelView : undefined);
  if (!panel) return undefined;
  const placement = registry?.getPlacement(panel);
  if (!placement || !registry) return widget;
  const canonical = Object.values(layout?.regions ?? {})
    .flatMap((region) => region.widgets)
    .find((candidate) => {
      const owner = candidate.placementIdentity;
      return (
        owner?.kind === "mode" &&
        owner.modeId === placement.modeId &&
        owner.placementId === placement.id &&
        (placement.item.kind === "view" ||
          Boolean(
            candidate.resource && widget.resource && referenceKey(candidate.resource) === referenceKey(widget.resource),
          ))
      );
    });
  if (canonical) return canonical;
  const owner = getOwnedPlacementPreparation(registry);
  const prepared = owner.open({
    placementId: placement.id,
    location: { section: widget.section, position: widget.position, pageContext: widget.pageContext },
    ...(placement.item.kind === "binding" && widget.resource ? { resource: widget.resource } : {}),
    ...(placement.item.kind === "binding" && placement.item.binding.cardinality === "many"
      ? { open: widget.tabRetention === "preview" ? ("preview" as const) : ("pin" as const) }
      : {}),
  });
  const next = owner
    .resolve(page.modeId, prepared.state)
    .find((entry) => placementIdentityKey(entry.identity) === placementIdentityKey(prepared.identity));
  return next
    ? { ...next.value, placementIdentity: next.identity, pinned: widget.pinned, tabRetention: widget.tabRetention }
    : undefined;
};

export const preparePageLanding = (
  page: WorkbenchPageContribution,
  registry: WorkbenchModePlacementRegistry,
  state: OwnedPlacementState,
  target?: { location: PageLocation; open?: PageOpenIntent },
) => {
  const landing = page.main.kind === "panels" ? page.main.landing : undefined;
  if (!landing || typeof landing === "string") return undefined;
  const placement = registry.getPlacement(landing);
  if (!placement || placement.modeId !== page.modeId)
    throw new Error(`Page "${page.id}" requires a landing placement in its mode`);
  if (placement.item.kind === "view") {
    if (target?.open) throw new Error("A static landing does not accept a resource open intent");
    return getOwnedPlacementPreparation(registry).open({ placementId: placement.id }, state);
  }
  if (!page.resource || placement.item.binding.cardinality !== "many" || placement.region !== "main")
    throw new Error(`Page "${page.id}" requires a many-resource Main landing viewer`);
  const resource = target?.location.resource;
  if (!resource || !resourceMatchesConstraint(page.resource, resource))
    throw new Error(`Page "${page.id}" requires a compatible landing resource`);
  return getOwnedPlacementPreparation(registry).open(
    {
      placementId: placement.id,
      resource,
      open: target.open,
      location: {
        section: target.location.section,
        position: target.location.position,
        pageContext: { page: target.location.page, parent: target.location.parent, params: target.location.params },
      },
    },
    state,
  );
};
