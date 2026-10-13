import { createDisposable } from "../../shared/disposable";
import { runWorkbenchEffect } from "../../shared/workbench-effect";
import {
  createDefaultWorkbenchLayout,
  mergeWithDefaultRegions,
  type WorkbenchLayout,
  type WorkbenchRegion,
} from "./layout-types";

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

export const resolveScopedLayout = (
  defaultRegionVisibility: Partial<Record<WorkbenchRegion, boolean>> | undefined,
  persisted: WorkbenchLayout | undefined,
) =>
  persisted
    ? mergeWithDefaultRegions(persisted, defaultRegionVisibility)
    : createDefaultWorkbenchLayout(defaultRegionVisibility);

export const createScopeEvent = <T>() => {
  const listeners = new Set<(value: T) => void>();
  return {
    notify(value: T) {
      for (const listener of listeners) runWorkbenchEffect("layout scope subscriber", () => listener(value));
    },
    subscribe(listener: (value: T) => void) {
      listeners.add(listener);
      return createDisposable(() => listeners.delete(listener));
    },
  };
};
