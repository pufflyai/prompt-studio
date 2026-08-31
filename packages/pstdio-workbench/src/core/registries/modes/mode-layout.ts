import type { Disposable } from "../../shared/disposable";
import {
  type WorkbenchLayout,
  type WorkbenchPanelRegion,
  type WorkbenchRegion,
  type WorkbenchWidgetPlacement,
  workbenchPanelRegions,
} from "../layout/layout-model";
import type { WorkbenchModeActivationContext, WorkbenchModeContribution } from "./mode-registry";

const modePanelRegions = {
  main: ["main-header", "main-left-menu", "main", "main-right-menu"],
  secondary: ["secondary-header", "secondary-left-menu", "secondary", "secondary-right-menu"],
  side: ["side-header", "side-left-menu", "side", "side-right-menu"],
} as const satisfies Record<WorkbenchPanelRegion, readonly WorkbenchRegion[]>;

const allModeRegions = Object.values(modePanelRegions).flat();

export const panelsForMode = (mode: WorkbenchModeContribution) => mode.panels ?? workbenchPanelRegions;

export const getWorkbenchModePanelForRegion = (region: WorkbenchRegion) =>
  (Object.keys(modePanelRegions) as WorkbenchPanelRegion[]).find((panel) =>
    modePanelRegions[panel].some((candidate) => candidate === region),
  );

export const isWorkbenchModePanelAvailable = (
  mode: WorkbenchModeContribution | undefined,
  panel: WorkbenchPanelRegion,
) => !mode || panelsForMode(mode).includes(panel);

const placementById = (layout: WorkbenchLayout, widgetId: string | undefined) => {
  if (!widgetId) return undefined;
  return Object.values(layout.regions)
    .flatMap((region) => region.widgets)
    .find((placement) => placement.widgetId === widgetId);
};

const withActivePlacement = (
  layout: WorkbenchLayout,
  candidates: readonly (WorkbenchWidgetPlacement | undefined)[],
) => {
  const active = candidates.find((placement) => placement && placementById(layout, placement.widgetId));
  return {
    ...layout,
    activeWidgetId: active?.widgetId,
    activeResourceUri: active?.resourceUri,
  };
};

const clearRegions = (layout: WorkbenchLayout, regionIds: readonly WorkbenchRegion[]) => {
  if (regionIds.length === 0) return layout;
  const clearedPanels = new Set(
    (Object.keys(modePanelRegions) as WorkbenchPanelRegion[]).filter((panel) =>
      modePanelRegions[panel].some((region) => regionIds.includes(region)),
    ),
  );
  const regionsNeedClearing = regionIds.some((regionId) => {
    const region = layout.regions[regionId];
    return region.widgets.length > 0 || region.activeWidgetId !== undefined || region.visible;
  });
  const selectionsNeedClearing = Object.values(layout.locationSubPanelSelections ?? {}).some((selections) =>
    Object.keys(selections).some((panel) => clearedPanels.has(panel as WorkbenchPanelRegion)),
  );
  if (!regionsNeedClearing && !selectionsNeedClearing) return layout;

  const regions = { ...layout.regions };
  for (const regionId of regionIds) {
    regions[regionId] = { ...regions[regionId], widgets: [], activeWidgetId: undefined, visible: false };
  }
  const locationSubPanelSelections = Object.fromEntries(
    Object.entries(layout.locationSubPanelSelections ?? {}).map(([resourceUri, selections]) => [
      resourceUri,
      Object.fromEntries(
        Object.entries(selections).filter(([panel]) => !clearedPanels.has(panel as WorkbenchPanelRegion)),
      ),
    ]),
  );
  const next = { ...layout, regions };
  return {
    ...withActivePlacement(next, [placementById(next, layout.activeWidgetId)]),
    activeLocationWidgetId: placementById(next, layout.activeLocationWidgetId)?.widgetId,
    locationSubPanelSelections,
  };
};

export const applyModePanelAvailability = (layout: WorkbenchLayout, panels: readonly WorkbenchPanelRegion[]) => {
  const available = new Set(panels);
  const unavailableRegions = (Object.keys(modePanelRegions) as WorkbenchPanelRegion[])
    .filter((panel) => !available.has(panel))
    .flatMap((panel) => modePanelRegions[panel]);
  return clearRegions(layout, unavailableRegions);
};

export const restoreUnscopedModeLayout = (
  current: WorkbenchLayout,
  saved: WorkbenchLayout | undefined,
  panels: readonly WorkbenchPanelRegion[],
) => {
  if (!saved) {
    const regions = { ...current.regions };
    for (const regionId of allModeRegions) {
      const region = regions[regionId];
      const widgets = region.widgets.filter((placement) => placement.role !== "content");
      regions[regionId] = {
        ...region,
        widgets,
        activeWidgetId: widgets.some((placement) => placement.widgetId === region.activeWidgetId)
          ? region.activeWidgetId
          : undefined,
      };
    }
    const withoutModeContent = { ...current, regions };
    return applyModePanelAvailability(
      {
        ...withActivePlacement(withoutModeContent, [placementById(withoutModeContent, current.activeWidgetId)]),
        activeLocationWidgetId: placementById(withoutModeContent, current.activeLocationWidgetId)?.widgetId,
      },
      panels,
    );
  }

  const regions = { ...current.regions };
  for (const regionId of allModeRegions) regions[regionId] = saved.regions[regionId];
  const merged = applyModePanelAvailability({ ...current, regions }, panels);
  const savedActive = placementById(merged, saved.activeWidgetId);
  const currentActive = placementById(merged, current.activeWidgetId);
  return {
    ...withActivePlacement(merged, [savedActive, currentActive]),
    activeLocationWidgetId:
      placementById(merged, saved.activeLocationWidgetId)?.widgetId ??
      placementById(merged, current.activeLocationWidgetId)?.widgetId,
    locationSubPanelSelections: saved.locationSubPanelSelections,
  };
};

export const disposeReverse = (disposables: readonly Disposable[]) => {
  for (let index = disposables.length - 1; index >= 0; index -= 1) {
    disposables[index]?.dispose();
  }
};

export const restoreModeLayout = (context: WorkbenchModeActivationContext, layout: WorkbenchLayout) => {
  if (layout !== context.layout.getLayout()) context.layout.restoreLayout(layout);
  for (const panel of workbenchPanelRegions) context.panels.setOpen(panel, layout.regions[panel].visible);
};
