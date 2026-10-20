import type { NavigationTarget, PlacementIdentity } from "@pstdio/sdk/extensions";
import { contributionRefId } from "@pstdio/sdk/extensions";
import type { WorkbenchLayout, WorkbenchPanelRegion } from "../../registries/layout/layout-model";
import type { WorkbenchOwnedPlacementItem } from "../../registries/placements/owned-placement-lifecycle";
import { shellPlacementContributionId } from "../../registries/placements/shell-placement-registry";
import type { ResourceRef } from "../../registries/resources/resource-registry";
import { modePlacementContributionId, pagePlacementContributionId } from "../../registries/views/view-placement";
import { resourceMatchesConstraint } from "../../shared/contributions/reference-id";
import { runUserAction } from "../../shared/run-user-action";
import type { WorkbenchCore } from "../../workbench-core";
import type { WorkbenchCompositionAddablePanel } from "./composition-controller";
import { panelDestinations } from "./panel-destinations";

const ownsPlacement = (
  layout: WorkbenchLayout,
  target: WorkbenchPanelRegion,
  matches: (identity: PlacementIdentity) => boolean,
) =>
  Object.values(layout.regions)
    .filter((region) => region.id === target)
    .some((region) =>
      region.widgets.some((placement) => placement.placementIdentity && matches(placement.placementIdentity)),
    );
interface AddablePanelInput {
  layout: WorkbenchLayout;
  modeId?: string;
  region: WorkbenchPanelRegion;
  resource?: ResourceRef;
}
type AddPanel = (panelId: string, open: WorkbenchCompositionAddablePanel["open"]) => void;
const openPlacementAddTarget = async (core: WorkbenchCore, target: NavigationTarget, region: WorkbenchPanelRegion) => {
  if (target.kind === "command") {
    await core.commands.executeCommand(contributionRefId(target.target.command), target.target.params, {
      source: "panel-add",
      region,
    });
  } else {
    if (target.kind === "panel") {
      await core.navigation.openTarget({ ...target, region });
      return;
    }
    if (target.kind === "compound") {
      await core.navigation.openTarget({
        ...target,
        targets: target.targets.map((item) => (item.kind === "panel" ? { ...item, region } : item)),
      });
      return;
    }
    await core.navigation.openTarget(target);
  }
};
const canAddItem = (core: WorkbenchCore, item: WorkbenchOwnedPlacementItem, resource: ResourceRef | undefined) => {
  if (item.kind !== "binding") return true;
  const target = item.binding.add;
  if (!target) return Boolean(resource && resourceMatchesConstraint(item.binding, resource));
  if (target.kind !== "command") return true;
  const id = contributionRefId(target.target.command);
  return Boolean(
    core.commands.getCommand(id) &&
      core.commands.isCommandVisible(id, target.target.params) &&
      core.commands.isCommandEnabled(id, target.target.params),
  );
};
const addShellPanels = (core: WorkbenchCore, input: AddablePanelInput, add: AddPanel) => {
  for (const placement of core.shellPlacements.listPlacements()) {
    if (!panelDestinations(core, shellPlacementContributionId(placement.id)).includes(input.region)) continue;
    if (placement.item.kind === "view" && placement.item.presence === "fixed") continue;
    const multiple = placement.item.kind === "binding" && placement.item.binding.cardinality === "many";
    const isOpen = ownsPlacement(
      input.layout,
      input.region,
      (identity) => identity.kind === "shell" && identity.placementId === placement.id,
    );
    if ((!multiple && isOpen) || !canAddItem(core, placement.item, input.resource)) continue;
    add(shellPlacementContributionId(placement.id), async (resource) => {
      if (placement.item.kind === "binding" && placement.item.binding.add) {
        return openPlacementAddTarget(core, placement.item.binding.add, input.region);
      }
      await core.navigation.openTarget({
        kind: "panel",
        panel: { kind: "shell-placement", id: placement.id },
        region: input.region,
        ...(placement.item.kind === "binding" && resource ? { resource, open: "pin" } : {}),
      });
    });
  }
};
const addModePanels = (core: WorkbenchCore, input: AddablePanelInput, add: AddPanel) => {
  for (const placement of core.modePlacements.listPlacements(input.modeId)) {
    if (!panelDestinations(core, modePlacementContributionId(placement.id)).includes(input.region)) continue;
    if (placement.item.kind === "view" && placement.item.presence === "fixed") continue;
    const multiple = placement.item.kind === "binding" && placement.item.binding.cardinality === "many";
    const isOpen = ownsPlacement(
      input.layout,
      input.region,
      (identity) => identity.kind === "mode" && identity.placementId === placement.id,
    );
    if ((!multiple && isOpen) || !canAddItem(core, placement.item, input.resource)) continue;
    add(modePlacementContributionId(placement.id), async (resource) => {
      if (placement.item.kind === "binding" && placement.item.binding.add) {
        return openPlacementAddTarget(core, placement.item.binding.add, input.region);
      }
      await core.navigation.openTarget({
        kind: "panel",
        panel: placement.ref,
        region: input.region,
        ...(placement.item.kind === "binding" && resource ? { resource, open: "pin" } : {}),
      });
    });
  }
};
const addPagePanels = (core: WorkbenchCore, input: AddablePanelInput, add: AddPanel) => {
  const pageState = core.pages.store.getState();
  const page = pageState.activePageId ? core.pages.getPage(pageState.activePageId) : undefined;
  if (!page) return;
  for (const slot of page.slots) {
    if (slot.isAvailable && !slot.isAvailable(input.resource)) continue;
    if (!panelDestinations(core, pagePlacementContributionId(page.id, slot.id)).includes(input.region)) continue;
    if (slot.item.kind === "view" && slot.item.presence === "fixed") continue;
    const multiple = slot.item.kind === "binding" && slot.item.binding.cardinality === "many";
    const isOpen = ownsPlacement(
      input.layout,
      input.region,
      (identity) => identity.kind === "page" && identity.pageId === page.id && identity.slotId === slot.id,
    );
    if ((!multiple && isOpen) || !canAddItem(core, slot.item, input.resource)) continue;
    add(pagePlacementContributionId(page.id, slot.id), async (resource) => {
      if (slot.item.kind === "binding" && slot.item.binding.add) {
        return openPlacementAddTarget(core, slot.item.binding.add, input.region);
      }
      await core.navigation.openTarget({
        kind: "panel",
        panel: { kind: "page-slot", page: page.ref, id: slot.id },
        region: input.region,
        ...(slot.item.kind === "binding" && resource ? { resource } : {}),
        ...(multiple ? { open: "pin" } : {}),
      });
    });
  }
};
export const createOwnedAddablePanels = (core: WorkbenchCore, input: AddablePanelInput) => {
  const addable: WorkbenchCompositionAddablePanel[] = [];
  const add = (panelId: string, open: WorkbenchCompositionAddablePanel["open"]) => {
    const contribution = core.layout.getWidget(panelId);
    if (contribution)
      addable.push({
        panelId,
        region: input.region,
        contribution,
        open: (resource) => runUserAction(core, "Add panel", () => open?.(resource)),
      });
  };
  addShellPanels(core, input, add);
  addModePanels(core, input, add);
  addPagePanels(core, input, add);
  return addable;
};
