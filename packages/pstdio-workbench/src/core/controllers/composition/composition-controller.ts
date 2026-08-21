import type {
  RegisteredWidgetContribution,
  WorkbenchLayout,
  WorkbenchPanelRegion,
  WorkbenchWidgetPlacement,
} from "../../registries/layout/layout-model";
import { isWorkbenchPanelPlacementVisible } from "../../registries/layout/panel-widget-eligibility";
import {
  isWorkbenchModePanelAvailable,
  type WorkbenchModeAddablePanel,
  type WorkbenchModeContribution,
} from "../../registries/modes/mode-registry";
import type { ResourceRef } from "../../registries/resources/resource-registry";

export interface WorkbenchCompositionAddablePanel extends WorkbenchModeAddablePanel {
  contribution: RegisteredWidgetContribution;
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
}

const isOpenSingleton = (
  widget: RegisteredWidgetContribution,
  placements: readonly WorkbenchWidgetPlacement[],
  resource: ResourceRef | undefined,
) => {
  if (!widget.singleton) return false;
  return placements.some((placement) => {
    if (placement.contributionId !== widget.id) return false;
    const scopedResourceUri = placement.role === "location" ? placement.resourceUri : placement.ownerResourceUri;
    return !scopedResourceUri || scopedResourceUri === resource?.uri;
  });
};

const addModePanels = (input: {
  addable: Map<string, WorkbenchCompositionAddablePanel>;
  mode: WorkbenchModeContribution | undefined;
  layout: WorkbenchLayout;
  placements: readonly WorkbenchWidgetPlacement[];
  region: WorkbenchPanelRegion;
  resource: ResourceRef | undefined;
  widgets: readonly RegisteredWidgetContribution[];
}) => {
  for (const panel of input.mode?.listAddablePanels?.({ layout: input.layout, resource: input.resource }) ?? []) {
    if (panel.region !== input.region) continue;
    const contribution = input.widgets.find((widget) => widget.id === panel.panelId);
    if (!contribution || isOpenSingleton(contribution, input.placements, input.resource)) continue;
    input.addable.set(panel.panelId, { ...panel, contribution });
  }
};

const addRegisteredPanels = (input: {
  addable: Map<string, WorkbenchCompositionAddablePanel>;
  modeId: string | undefined;
  placements: readonly WorkbenchWidgetPlacement[];
  region: WorkbenchPanelRegion;
  resource: ResourceRef | undefined;
  widgets: readonly RegisteredWidgetContribution[];
}) => {
  for (const contribution of input.widgets) {
    if (!contribution.eligibleLocations) continue;
    if (contribution.region !== input.region && contribution.fallbackRegion !== input.region) continue;
    if (input.addable.has(contribution.id) || isOpenSingleton(contribution, input.placements, input.resource)) continue;
    if (!isWorkbenchPanelPlacementVisible(contribution, input.resource, input.modeId)) continue;
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
    const mode = input.getActiveMode();
    if (!isWorkbenchModePanelAvailable(mode, region)) return { open, addable: [], closable: [] };

    const placements = Object.values(layout.regions).flatMap((candidate) => candidate.widgets);
    const widgets = input.listWidgets();
    const addable = new Map<string, WorkbenchCompositionAddablePanel>();

    addModePanels({ addable, layout, mode, placements, region, resource, widgets });
    addRegisteredPanels({ addable, modeId: mode?.id, placements, region, resource, widgets });

    return {
      open,
      addable: [...addable.values()],
      closable: open.filter((placement) => placement.closable === true).map((placement) => placement.contributionId),
    };
  },
});
