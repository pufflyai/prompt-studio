import { createDisposable } from "../../shared/disposable";
import { withoutPreviewTabs } from "./layout-tab-lifecycle";
import {
  createDefaultWorkbenchLayout,
  mergeWithDefaultRegions,
  type WorkbenchLayout,
  type WorkbenchRegion,
  type WorkbenchRegionState,
  type WorkbenchWidgetPlacement,
} from "./layout-types";

const isPreviewTab = (placement: WorkbenchWidgetPlacement) => placement.tabRetention === "preview";

const carriedActiveWidgetId = (
  current: WorkbenchRegionState,
  incoming: WorkbenchRegionState,
  widgets: readonly WorkbenchWidgetPlacement[],
) => {
  const widgetIds = new Set(widgets.map((placement) => placement.widgetId));
  if (incoming.activeWidgetId && widgetIds.has(incoming.activeWidgetId)) return incoming.activeWidgetId;
  if (current.activeWidgetId && widgetIds.has(current.activeWidgetId)) return current.activeWidgetId;
  return widgets[0]?.widgetId;
};

const carryPersistentRegionTabs = (current: WorkbenchRegionState, incoming: WorkbenchRegionState) => {
  const currentPersistentTabs = current.widgets.filter((placement) => !isPreviewTab(placement));
  if (currentPersistentTabs.length === 0) return incoming;

  const incomingPreviewTabs = incoming.widgets.filter(isPreviewTab);
  const incomingPreviewIds = new Set(incomingPreviewTabs.map((placement) => placement.widgetId));
  const widgets = [
    ...incomingPreviewTabs,
    ...currentPersistentTabs.filter((placement) => !incomingPreviewIds.has(placement.widgetId)),
  ];

  return {
    ...current,
    widgets,
    activeWidgetId: carriedActiveWidgetId(current, incoming, widgets),
  };
};

export const carryPinnedWorkbenchChrome = (current: WorkbenchLayout, incoming: WorkbenchLayout) => {
  const regions = { ...incoming.regions };

  for (const region of Object.values(current.regions)) {
    const pinned = region.widgets.filter((placement) => placement.pinned && placement.role === "content");
    if (pinned.length === 0) continue;
    const contributionIds = new Set(pinned.map((placement) => placement.contributionId));
    const incomingRegion = incoming.regions[region.id];
    regions[region.id] = {
      ...incomingRegion,
      widgets: [
        ...pinned,
        ...incomingRegion.widgets.filter((placement) => !contributionIds.has(placement.contributionId)),
      ],
      activeWidgetId: incomingRegion.activeWidgetId ?? pinned[0]?.widgetId,
    };
  }
  return { ...incoming, regions };
};

export const carryWorkbenchRegionState = (
  current: WorkbenchLayout,
  incoming: WorkbenchLayout,
  regionIds: readonly WorkbenchRegion[],
) => {
  if (regionIds.length === 0) return incoming;
  const regions = { ...incoming.regions };
  for (const regionId of regionIds) {
    regions[regionId] =
      incoming.regions[regionId].widgets.length > 0
        ? carryPersistentRegionTabs(current.regions[regionId], incoming.regions[regionId])
        : current.regions[regionId];
  }
  return { ...incoming, regions };
};

export const resolveScopedLayout = (
  defaultRegionVisibility: Partial<Record<WorkbenchRegion, boolean>> | undefined,
  persisted: WorkbenchLayout | undefined,
) =>
  persisted
    ? mergeWithDefaultRegions(withoutPreviewTabs(persisted), defaultRegionVisibility)
    : createDefaultWorkbenchLayout(defaultRegionVisibility);

export const createScopeEvent = <T>() => {
  const listeners = new Set<(value: T) => void>();
  return {
    notify(value: T) {
      for (const listener of listeners) listener(value);
    },
    subscribe(listener: (value: T) => void) {
      listeners.add(listener);
      return createDisposable(() => listeners.delete(listener));
    },
  };
};
