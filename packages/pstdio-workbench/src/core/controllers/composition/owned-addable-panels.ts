import type { NavigationTarget, PlacementIdentity } from "@pstdio/sdk/extensions";
import type { WorkbenchLayout, WorkbenchPanelRegion } from "../../registries/layout/layout-model";
import { placementIdentityKey } from "../../registries/layout/placement-reconciliation";
import type { WorkbenchPageSlot } from "../../registries/pages/page-registry";
import type { WorkbenchOwnedPlacementItem } from "../../registries/placements/owned-placement-lifecycle";
import { shellPlacementContributionId } from "../../registries/placements/shell-placement-registry";
import type { ResourceRef } from "../../registries/resources/resource-registry";
import { modePlacementContributionId, pagePlacementContributionId } from "../../registries/views/view-placement";
import { contributionRefId, resourceMatchesConstraint } from "../../shared/contributions/reference-id";
import type { WorkbenchCore } from "../../workbench-core";
import type { WorkbenchCompositionAddablePanel } from "./composition-controller";

const ownsPlacement = (layout: WorkbenchLayout, matches: (identity: PlacementIdentity) => boolean) =>
  Object.values(layout.regions).some((region) =>
    region.widgets.some((placement) => placement.placementIdentity && matches(placement.placementIdentity)),
  );
export const activateModePlacementInstance = (core: WorkbenchCore, identity: PlacementIdentity) => {
  const instance = Object.values(core.layout.getLayout().regions)
    .flatMap((region) => region.widgets)
    .find(
      (candidate) =>
        candidate.placementIdentity &&
        placementIdentityKey(candidate.placementIdentity) === placementIdentityKey(identity),
    );
  if (instance) core.layout.activatePanel(instance.widgetId);
};
interface AddablePanelInput {
  layout: WorkbenchLayout;
  modeId?: string;
  region: WorkbenchPanelRegion;
  resource?: ResourceRef;
}
type AddPanel = (panelId: string, open: WorkbenchCompositionAddablePanel["open"]) => void;
const openPlacementAddTarget = (core: WorkbenchCore, target: NavigationTarget) => {
  if (target.kind === "command") {
    void core.commands.executeCommand(contributionRefId(target.target.command), target.target.params, {
      source: "panel-add",
    });
    return;
  }
  void core.navigation.openTarget(target);
};
const acceptsItemResource = (item: WorkbenchOwnedPlacementItem, resource: ResourceRef | undefined) =>
  item.kind !== "binding" ||
  Boolean(item.binding.add) ||
  Boolean(resource && resourceMatchesConstraint(item.binding, resource));
const addShellPanels = (core: WorkbenchCore, input: AddablePanelInput, add: AddPanel) => {
  for (const placement of core.shellPlacements.listPlacements()) {
    if (placement.region !== input.region) continue;
    if (placement.item.kind === "view" && placement.item.presence === "fixed") continue;
    const multiple = placement.item.kind === "binding" && placement.item.binding.cardinality === "many";
    const isOpen = ownsPlacement(
      input.layout,
      (identity) => identity.kind === "shell" && identity.placementId === placement.id,
    );
    if ((!multiple && isOpen) || !acceptsItemResource(placement.item, input.resource)) continue;
    add(shellPlacementContributionId(placement.id), (resource) => {
      if (placement.item.kind === "binding" && placement.item.binding.add) {
        openPlacementAddTarget(core, placement.item.binding.add);
        return;
      }
      core.shellPlacements.openPlacement({
        placementId: placement.id,
        ...(placement.item.kind === "binding" && resource ? { resource, open: "pin" } : {}),
      });
    });
  }
};
const addModePanels = (core: WorkbenchCore, input: AddablePanelInput, add: AddPanel) => {
  for (const placement of core.modePlacements.listPlacements(input.modeId)) {
    if (placement.region !== input.region) continue;
    if (placement.item.kind === "view" && placement.item.presence === "fixed") continue;
    const multiple = placement.item.kind === "binding" && placement.item.binding.cardinality === "many";
    const isOpen = ownsPlacement(
      input.layout,
      (identity) => identity.kind === "mode" && identity.placementId === placement.id,
    );
    if ((!multiple && isOpen) || !acceptsItemResource(placement.item, input.resource)) continue;
    add(modePlacementContributionId(placement.id), (resource) => {
      if (placement.item.kind === "binding" && placement.item.binding.add) {
        openPlacementAddTarget(core, placement.item.binding.add);
        return;
      }
      const identity = core.modePlacements.openPlacement({
        panel: placement.ref,
        ...(placement.item.kind === "binding" && resource ? { resource, open: "pin" } : {}),
      });
      activateModePlacementInstance(core, identity);
    });
  }
};
const acceptsPageSlotResource = (slot: WorkbenchPageSlot, resource: ResourceRef | undefined) =>
  acceptsItemResource(slot.item, resource);
const addPagePanels = (core: WorkbenchCore, input: AddablePanelInput, add: AddPanel) => {
  const pageState = core.pages.store.getState();
  const page = pageState.activePageId ? core.pages.getPage(pageState.activePageId) : undefined;
  if (!page) return;
  for (const slot of page.slots) {
    if (slot.region !== input.region) continue;
    if (slot.item.kind === "view" && slot.item.presence === "fixed") continue;
    const multiple = slot.item.kind === "binding" && slot.item.binding.cardinality === "many";
    const isOpen = ownsPlacement(
      input.layout,
      (identity) => identity.kind === "page" && identity.pageId === page.id && identity.slotId === slot.id,
    );
    if ((!multiple && isOpen) || !acceptsPageSlotResource(slot, input.resource)) continue;
    add(pagePlacementContributionId(page.id, slot.id), (resource) => {
      if (slot.item.kind === "binding" && slot.item.binding.add) {
        openPlacementAddTarget(core, slot.item.binding.add);
        return;
      }
      core.pages.openSlot({
        pageId: page.id,
        slotId: slot.id,
        ...(resource ? { resource: resource } : {}),
        ...(multiple ? { open: "pin" } : {}),
      });
    });
  }
};
export const createOwnedAddablePanels = (core: WorkbenchCore, input: AddablePanelInput) => {
  const addable: WorkbenchCompositionAddablePanel[] = [];
  const add = (panelId: string, open: WorkbenchCompositionAddablePanel["open"]) => {
    const contribution = core.layout.getWidget(panelId);
    if (contribution) addable.push({ panelId, region: input.region, contribution, open });
  };
  addShellPanels(core, input, add);
  addModePanels(core, input, add);
  addPagePanels(core, input, add);
  return addable;
};
