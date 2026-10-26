import type { NavigationTarget, PlacementIdentity, PlacementRef } from "@pstdio/sdk/extensions";
import { contributionRefId } from "@pstdio/sdk/extensions";
import type {
  WorkbenchLayout,
  WorkbenchPanelRegion,
  WorkbenchWidgetPlacement,
} from "../../registries/layout/layout-model";
import { placementIdentityKey } from "../../registries/layout/placement-reconciliation";
import { pageSlots, type ResolvedPageSlot } from "../../registries/pages/page-main";
import type { WorkbenchOwnedPlacementItem } from "../../registries/placements/owned-placement-lifecycle";
import { shellPlacementContributionId } from "../../registries/placements/shell-placement-registry";
import type { ResourceRef } from "../../registries/resources/resource-registry";
import { modePlacementContributionId, pagePlacementContributionId } from "../../registries/views/view-placement";
import { runUserAction } from "../../shared/run-user-action";
import type { WorkbenchCore } from "../../workbench-core";
import { collectionMainOwner } from "../page-runtime/collection-main-owner";
import type { WorkbenchCompositionAddablePanel } from "./composition-controller";
import { panelDestinations } from "./panel-destinations";

const ownsPlacement = (
  layout: WorkbenchLayout,
  matches: (identity: PlacementIdentity, placement: WorkbenchWidgetPlacement) => boolean,
) =>
  Object.values(layout.regions).some((region) =>
    region.widgets.some((placement) => placement.placementIdentity && matches(placement.placementIdentity, placement)),
  );
export const activateModePlacementInstance = (core: WorkbenchCore, identity: PlacementIdentity) => {
  const instance = Object.values(core.layout.getLayout().regions)
    .flatMap((region) => region.widgets)
    .find(
      (candidate) =>
        candidate.placementIdentity &&
        placementIdentityKey(candidate.placementIdentity) === placementIdentityKey(identity),
    );
  if (instance) {
    core.layout.activatePanel(instance.widgetId);
  }
};
interface AddablePanelInput {
  layout: WorkbenchLayout;
  modeId?: string;
  region: WorkbenchPanelRegion;
  resource?: ResourceRef;
}
type AddPanel = (
  panelId: string,
  open: WorkbenchCompositionAddablePanel["open"],
  item: WorkbenchOwnedPlacementItem,
) => void;

const offersPageMain = (core: WorkbenchCore, ref: PlacementRef) => {
  const pages = core.pages.listPages();
  const matches = (candidate: PlacementRef | undefined) =>
    candidate && contributionRefId(candidate) === contributionRefId(ref);
  const owners = pages.filter(
    (page) =>
      matches(page.panelView) ||
      (page.main.kind === "panels" && typeof page.main.landing === "object" && matches(page.main.landing)),
  );
  if (!owners.length) return true;
  const active = core.pages.getPage(core.pages.store.getState().activePageId ?? "");
  const collection = collectionMainOwner(active, pages);
  return owners.some((page) => collectionMainOwner(page, pages)?.id === collection?.id);
};
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
const canAddItem = (core: WorkbenchCore, item: WorkbenchOwnedPlacementItem) => {
  if (item.kind !== "binding") return true;
  const target = item.binding.add;
  if (!target) return false;
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
    const multiple = placement.item.kind === "binding" && placement.item.binding.cardinality === "many";
    const isOpen = ownsPlacement(
      input.layout,
      (identity) => identity.kind === "shell" && identity.placementId === placement.id,
    );
    if ((!multiple && isOpen) || !canAddItem(core, placement.item)) continue;
    add(
      shellPlacementContributionId(placement.id),
      () => {
        if (placement.item.kind === "binding" && placement.item.binding.add) {
          return openPlacementAddTarget(core, placement.item.binding.add, input.region);
        }
        const identity = core.shellPlacements.openPlacement({
          placementId: placement.id,
          region: input.region,
        });
        activateModePlacementInstance(core, identity);
      },
      placement.item,
    );
  }
};
const addModePanels = (core: WorkbenchCore, input: AddablePanelInput, add: AddPanel) => {
  // Navigation opens a mode panel only in its own mode, so offer none before a mode is active.
  if (!input.modeId) return;
  for (const placement of core.modePlacements.listPlacements(input.modeId)) {
    if (input.region === "main" && placement.item.kind === "view" && !offersPageMain(core, placement.ref)) continue;
    const addableIn = placement.addableIn ?? placement.movableTo;
    if (addableIn && !addableIn.includes(input.region)) continue;
    if (!panelDestinations(core, modePlacementContributionId(placement.id)).includes(input.region)) continue;
    const multiple = placement.item.kind === "binding" && placement.item.binding.cardinality === "many";
    const isOpen = ownsPlacement(
      input.layout,
      (identity) => identity.kind === "mode" && identity.placementId === placement.id,
    );
    if ((!multiple && isOpen) || !canAddItem(core, placement.item)) continue;
    add(
      modePlacementContributionId(placement.id),
      () => {
        if (placement.item.kind === "binding" && placement.item.binding.add) {
          return openPlacementAddTarget(core, placement.item.binding.add, input.region);
        }
        const identity = core.modePlacements.openPlacement({
          panel: placement.ref,
          region: input.region,
        });
        activateModePlacementInstance(core, identity);
      },
      placement.item,
    );
  }
};
const pageSlotAvailable = (core: WorkbenchCore, pageId: string, slot: ResolvedPageSlot, input: AddablePanelInput) => {
  const addableIn = slot.addableIn ?? slot.movableTo;
  if (addableIn && !addableIn.includes(input.region)) return false;
  if (slot.role === "primary" && input.region !== "main") return false;
  if (slot.isAvailable && !slot.isAvailable(input.resource)) return false;
  return panelDestinations(core, pagePlacementContributionId(pageId, slot.id)).includes(input.region);
};
const addPagePanels = (core: WorkbenchCore, input: AddablePanelInput, add: AddPanel) => {
  const pageState = core.pages.store.getState();
  const page = pageState.activePageId ? core.pages.getPage(pageState.activePageId) : undefined;
  if (!page) return;
  for (const slot of pageSlots(page)) {
    if (!pageSlotAvailable(core, page.id, slot, input)) continue;
    const many = slot.item.kind === "binding" && slot.item.binding.cardinality === "many";
    const multiple = slot.role !== "primary" && many;
    const defaultResource = slot.role === "primary" ? pageState.location?.resource : input.resource;
    const isOpen = ownsPlacement(
      input.layout,
      (identity, placement) =>
        identity.kind === "page" &&
        identity.pageId === page.id &&
        identity.slotId === slot.id &&
        (slot.role !== "primary" ||
          !defaultResource ||
          (placement.resource &&
            core.pages.resourceReferenceKey(placement.resource) ===
              core.pages.resourceReferenceKey(defaultResource))) === true,
    );
    if ((!multiple && isOpen) || !canAddItem(core, slot.item)) continue;
    add(
      pagePlacementContributionId(page.id, slot.id),
      () => {
        if (slot.item.kind === "binding" && slot.item.binding.add) {
          return openPlacementAddTarget(core, slot.item.binding.add, input.region);
        }
        core.pages.openSlot({
          pageId: page.id,
          slotId: slot.id,
          region: input.region,
        });
        const opened = Object.values(core.layout.getLayout().regions)
          .flatMap((region) => region.widgets)
          .find(
            (p) =>
              p.widgetId === core.layout.getLayout().activeWidgetId &&
              p.contributionId === pagePlacementContributionId(page.id, slot.id),
          );
        if (opened?.placementIdentity) activateModePlacementInstance(core, opened.placementIdentity);
      },
      slot.item,
    );
  }
};
export const createOwnedAddablePanels = (core: WorkbenchCore, input: AddablePanelInput) => {
  const addable: WorkbenchCompositionAddablePanel[] = [];
  const add: AddPanel = (panelId, open, item) => {
    const contribution = core.layout.getWidget(panelId);
    const target = item.kind === "binding" ? item.binding.add : undefined;
    const command =
      target?.kind === "command"
        ? core.commands.getCommand(contributionRefId(target.target.command))?.command
        : undefined;
    if (contribution)
      addable.push({
        panelId,
        region: input.region,
        contribution: command
          ? { ...contribution, title: command.label, icon: command.icon ?? contribution.icon }
          : contribution,
        open: (resource) => runUserAction(core, "Add panel", () => open?.(resource)),
      });
  };
  addShellPanels(core, input, add);
  addModePanels(core, input, add);
  addPagePanels(core, input, add);
  return addable;
};
