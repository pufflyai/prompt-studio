import type { NavigationTarget } from "@pstdio/sdk/extensions";
import { contributionRefId, resourceKey } from "@pstdio/sdk/extensions";
import type { WorkbenchLayout, WorkbenchPanelRegion } from "../../registries/layout/layout-model";
import type { WorkbenchOwnedPlacementItem } from "../../registries/placements/owned-placement-lifecycle";
import { shellPlacementContributionId } from "../../registries/placements/shell-placement-registry";
import type { ResourceRef } from "../../registries/resources/resource-registry";
import { modePlacementContributionId, pagePlacementContributionId } from "../../registries/views/view-placement";
import { resourceMatchesConstraint } from "../../shared/contributions/reference-id";
import { runUserAction } from "../../shared/run-user-action";
import type { WorkbenchCore } from "../../workbench-core";
import { openWorkbenchPanel } from "../navigation/panel-navigation";
import {
  findOpenEditor,
  findOpenResourceEditor,
  prepareEditorActivation,
} from "../navigation/resource-editor-resolver";
import { openOwnerLayouts } from "../page-runtime/open-owner-layouts";
import type { WorkbenchCompositionAddablePanel } from "./composition-controller";
import { panelDestinations } from "./panel-destinations";

const activateCatalogEditor = (
  core: WorkbenchCore,
  panelId: string,
  item: WorkbenchOwnedPlacementItem,
  resource?: ResourceRef,
) => {
  const viewId = contributionRefId(item.kind === "view" ? item.view : item.binding.view);
  const existing = resource ? findOpenResourceEditor(core, viewId, resource) : undefined;
  const editor =
    existing ??
    (item.kind === "view"
      ? findOpenEditor(
          core,
          (tab) => tab.contributionId === panelId && resourceKey(tab.resource) === resourceKey(resource),
        )
      : undefined);
  if (!editor) return false;
  prepareEditorActivation(core, editor).commit();
  return true;
};
interface AddablePanelInput {
  layout: WorkbenchLayout;
  modeId?: string;
  region: WorkbenchPanelRegion;
  resource?: ResourceRef;
}
type AddPanel = (panelId: string, open: WorkbenchCompositionAddablePanel["open"]) => void;
const openPlacementAddTarget = (
  core: WorkbenchCore,
  target: NavigationTarget,
  panelId: string,
  region: WorkbenchPanelRegion,
) =>
  runUserAction(core, "Add panel", async () => {
    const existingIds = new Set(
      openOwnerLayouts(core).flatMap((owner) =>
        Object.values(owner.layout.regions).flatMap((r) => r.widgets.map((tab) => tab.widgetId)),
      ),
    );
    if (target.kind === "command") {
      await core.commands.executeCommand(contributionRefId(target.target.command), target.target.params, {
        source: "panel-add",
      });
    } else {
      await core.navigation.openTarget(target);
    }
    const active = core.layout.getActivePanel();
    if (active?.panelId === panelId && !existingIds.has(active.instanceId)) core.movePanel(active.instanceId, region);
  });
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
    if (!canAddItem(core, placement.item, input.resource)) continue;
    add(shellPlacementContributionId(placement.id), (resource) => {
      if (
        activateCatalogEditor(
          core,
          shellPlacementContributionId(placement.id),
          placement.item,
          placement.item.kind === "view" ? undefined : resource,
        )
      )
        return;
      if (placement.item.kind === "binding" && placement.item.binding.add) {
        return openPlacementAddTarget(
          core,
          placement.item.binding.add,
          shellPlacementContributionId(placement.id),
          input.region,
        );
      }
      openWorkbenchPanel(
        core,
        {
          kind: "panel",
          panel: { kind: "shell-placement", id: placement.id },
          ...(placement.item.kind === "binding" && resource ? { resource, open: "pin" } : {}),
        },
        input.region,
      );
    });
  }
};
const addModePanels = (core: WorkbenchCore, input: AddablePanelInput, add: AddPanel) => {
  for (const placement of core.modePlacements.listPlacements(input.modeId)) {
    if (!panelDestinations(core, modePlacementContributionId(placement.id)).includes(input.region)) continue;
    if (!canAddItem(core, placement.item, input.resource)) continue;
    add(modePlacementContributionId(placement.id), (resource) => {
      if (
        activateCatalogEditor(
          core,
          modePlacementContributionId(placement.id),
          placement.item,
          placement.item.kind === "view" ? undefined : resource,
        )
      )
        return;
      if (placement.item.kind === "binding" && placement.item.binding.add) {
        return openPlacementAddTarget(
          core,
          placement.item.binding.add,
          modePlacementContributionId(placement.id),
          input.region,
        );
      }
      openWorkbenchPanel(
        core,
        {
          kind: "panel",
          panel: placement.ref,
          ...(placement.item.kind === "binding" && resource ? { resource, open: "pin" } : {}),
        },
        input.region,
      );
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
    const multiple = slot.item.kind === "binding" && slot.item.binding.cardinality === "many";
    const catalogResource = (resource?: ResourceRef) => (slot.item.kind === "view" ? input.resource : resource);
    if (!canAddItem(core, slot.item, input.resource)) continue;
    add(pagePlacementContributionId(page.id, slot.id), (resource) => {
      if (
        activateCatalogEditor(core, pagePlacementContributionId(page.id, slot.id), slot.item, catalogResource(resource))
      )
        return;
      if (slot.item.kind === "binding" && slot.item.binding.add) {
        return openPlacementAddTarget(
          core,
          slot.item.binding.add,
          pagePlacementContributionId(page.id, slot.id),
          input.region,
        );
      }
      openWorkbenchPanel(
        core,
        {
          kind: "panel",
          panel: { kind: "page-slot", page: page.ref, id: slot.id },
          ...(slot.item.kind === "binding" && resource ? { resource } : {}),
          ...(multiple ? { open: "pin" } : {}),
        },
        input.region,
      );
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
