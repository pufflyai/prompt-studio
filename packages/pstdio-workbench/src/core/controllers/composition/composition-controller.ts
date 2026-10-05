import { resourceKey } from "@pstdio/sdk/extensions";
import type {
  RegisteredWidgetContribution,
  WorkbenchLayout,
  WorkbenchPanelRegion,
  WorkbenchWidgetPlacement,
} from "../../registries/layout/layout-model";
import { getActiveLocationPlacement } from "../../registries/layout/layout-operations";
import { isWorkbenchPanelPlacementVisible } from "../../registries/layout/panel-widget-eligibility";
import {
  isWorkbenchModePanelAvailable,
  type WorkbenchModeAddablePanel,
  type WorkbenchModeContribution,
} from "../../registries/modes/mode-registry";
import type { ResourceRef } from "../../registries/resources/resource-registry";
import { allowedPanelDestinations } from "./panel-destinations";
export interface WorkbenchCompositionAddablePanel extends WorkbenchModeAddablePanel {
  contribution: RegisteredWidgetContribution;
  open?(resource?: ResourceRef): void | Promise<void>;
}
export interface WorkbenchCompositionRegionPanels {
  open: readonly WorkbenchWidgetPlacement[];
  addable: readonly WorkbenchCompositionAddablePanel[];
  closable: readonly string[];
}
export interface WorkbenchCompositionController {
  panelsFor(region: WorkbenchPanelRegion): WorkbenchCompositionRegionPanels;
}
interface CreateWorkbenchCompositionControllerInput {
  getActiveMode(): WorkbenchModeContribution | undefined;
  getLayout(): WorkbenchLayout;
  getResource(): ResourceRef | undefined;
  listWidgets(): RegisteredWidgetContribution[];
  listOwnedAddablePanels?(input: {
    layout: WorkbenchLayout;
    mode: WorkbenchModeContribution | undefined;
    region: WorkbenchPanelRegion;
    resource: ResourceRef | undefined;
  }): readonly WorkbenchCompositionAddablePanel[];
}
const isOpenSingleton = (
  widget: RegisteredWidgetContribution,
  placements: readonly WorkbenchWidgetPlacement[],
  resource: ResourceRef | undefined,
) => {
  if (!widget.singleton) return false;
  return placements.some((placement) => {
    if (placement.contributionId !== widget.id) return false;
    const scopedResourceKey = placement.role === "location" ? placement.resourceKey : placement.ownerResourceKey;
    return !scopedResourceKey || scopedResourceKey === resourceKey(resource);
  });
};
const addModePanels = (input: {
  addable: Map<string, WorkbenchCompositionAddablePanel>;
  mode: WorkbenchModeContribution | undefined;
  modePanels: readonly WorkbenchModeAddablePanel[];
  layout: WorkbenchLayout;
  placements: readonly WorkbenchWidgetPlacement[];
  region: WorkbenchPanelRegion;
  resource: ResourceRef | undefined;
  widgets: readonly RegisteredWidgetContribution[];
}) => {
  for (const panel of input.modePanels) {
    if (!["main", "side", "secondary"].includes(panel.region)) continue;
    if (!allowedPanelDestinations({ mode: input.mode, allowedRegions: panel.allowedRegions }).includes(input.region))
      continue;
    const contribution = input.widgets.find((widget) => widget.id === panel.panelId);
    if (!contribution || isOpenSingleton(contribution, input.placements, input.resource)) continue;
    input.addable.set(panel.panelId, { ...panel, region: input.region, contribution });
  }
};
const addRegisteredPanels = (input: {
  addable: Map<string, WorkbenchCompositionAddablePanel>;
  mode: WorkbenchModeContribution | undefined;
  modePanels: readonly WorkbenchModeAddablePanel[];
  location: WorkbenchWidgetPlacement | undefined;
  placements: readonly WorkbenchWidgetPlacement[];
  region: WorkbenchPanelRegion;
  resource: ResourceRef | undefined;
  widgets: readonly RegisteredWidgetContribution[];
}) => {
  for (const contribution of input.widgets) {
    if (!contribution.eligibleLocations) continue;
    if (!["main", "side", "secondary"].includes(contribution.region)) continue;
    const policy = input.modePanels.find((panel) => panel.panelId === contribution.id);
    if (!allowedPanelDestinations({ mode: input.mode, allowedRegions: policy?.allowedRegions }).includes(input.region))
      continue;
    if (input.addable.has(contribution.id) || isOpenSingleton(contribution, input.placements, input.resource)) continue;
    if (
      !isWorkbenchPanelPlacementVisible(contribution, input.resource, input.mode?.id, undefined, {
        location: input.location,
      })
    )
      continue;
    input.addable.set(contribution.id, { panelId: contribution.id, region: input.region, contribution });
  }
};
export const createWorkbenchCompositionController = (
  input: CreateWorkbenchCompositionControllerInput,
): WorkbenchCompositionController => ({
  panelsFor(region) {
    const layout = input.getLayout();
    const open = layout.regions[region]?.widgets ?? [];
    const resource = input.getResource();
    const location = getActiveLocationPlacement(layout);
    const mode = input.getActiveMode();
    if (!isWorkbenchModePanelAvailable(mode, region)) return { open, addable: [], closable: [] };
    const placements = open;
    const widgets = input.listWidgets();
    const modePanels = mode?.listAddablePanels?.({ layout, resource }) ?? [];
    const addable = new Map<string, WorkbenchCompositionAddablePanel>();
    for (const panel of input.listOwnedAddablePanels?.({ layout, mode, region, resource }) ?? []) {
      addable.set(panel.panelId, panel);
    }
    addModePanels({ addable, layout, mode, modePanels, placements, region, resource, widgets });
    addRegisteredPanels({ addable, location, mode, modePanels, placements, region, resource, widgets });
    return {
      open,
      addable: [...addable.values()],
      closable: open.filter((placement) => placement.closable === true).map((placement) => placement.contributionId),
    };
  },
});
