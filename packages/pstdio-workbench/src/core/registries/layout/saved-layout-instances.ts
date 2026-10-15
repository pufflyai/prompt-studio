import type { WorkbenchLayout } from "./layout-types";
import { placementIdentityKey } from "./placement-reconciliation";

/** Stored presentation records must describe each live instance only once. */
export const uniqueSavedInstances = (layout: WorkbenchLayout) => {
  const widgets = new Set<string>();
  const identities = new Set<string>();
  const regions = { ...layout.regions };
  for (const region of Object.values(regions)) {
    const retained = region.widgets.filter((tab) => {
      const identity = tab.placementIdentity && placementIdentityKey(tab.placementIdentity);
      if (widgets.has(tab.widgetId) || (identity && identities.has(identity))) return false;
      widgets.add(tab.widgetId);
      if (identity) identities.add(identity);
      return true;
    });
    regions[region.id] = { ...region, widgets: retained };
  }
  return { ...layout, regions };
};
