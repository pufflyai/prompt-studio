import type { WorkbenchLayout, WorkbenchRegion, WorkbenchWidgetPlacement } from "./layout-types";
import { placementIdentityKey } from "./placement-reconciliation";

export const indexCurrentOwnedPlacements = (layout: WorkbenchLayout) => {
  const indexed = new Map<string, { region: WorkbenchRegion; placement: WorkbenchWidgetPlacement }>();
  for (const region of Object.values(layout.regions)) {
    for (const placement of region.widgets) {
      if (!placement.placementIdentity) continue;
      const key = placementIdentityKey(placement.placementIdentity);
      if (indexed.has(key)) throw new Error(`Duplicate rendered placement identity: ${key}`);
      indexed.set(key, { region: region.id, placement });
    }
  }
  return indexed;
};

export const indexCurrentWidgetOwners = (layout: WorkbenchLayout) => {
  const owners = new Map<string, string | null>();
  for (const region of Object.values(layout.regions)) {
    for (const placement of region.widgets) {
      if (owners.has(placement.widgetId)) throw new Error(`Duplicate rendered widget ID: ${placement.widgetId}`);
      owners.set(
        placement.widgetId,
        placement.placementIdentity ? placementIdentityKey(placement.placementIdentity) : null,
      );
    }
  }
  return owners;
};
