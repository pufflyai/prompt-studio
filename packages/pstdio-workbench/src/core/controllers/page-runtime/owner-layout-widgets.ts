import type { WorkbenchLayout } from "../../registries/layout/layout-types";
import { SINGLE_RESOURCE_INSTANCE_KEY } from "../../registries/placements/placement-instance-key";

export const replaceLayoutWidgetIds = (layout: WorkbenchLayout, replacements: ReadonlyMap<string, string>) => {
  if (!replacements.size) return layout;
  const replace = (id: string | undefined) => (id ? (replacements.get(id) ?? id) : id);
  const regions = { ...layout.regions };
  for (const region of Object.values(regions)) {
    regions[region.id] = {
      ...region,
      activeWidgetId: replace(region.activeWidgetId),
      savedWidgetOrder: region.savedWidgetOrder?.map((id) => replace(id)!),
      widgets: region.widgets.map((p) => ({ ...p, widgetId: replace(p.widgetId)! })),
    };
  }
  return {
    ...layout,
    regions,
    activeWidgetId: replace(layout.activeWidgetId),
    activeLocationWidgetId: replace(layout.activeLocationWidgetId),
    locationSubPanelSelections:
      layout.locationSubPanelSelections &&
      Object.fromEntries(
        Object.entries(layout.locationSubPanelSelections).map(([key, selection]) => [
          key,
          Object.fromEntries(Object.entries(selection).map(([region, id]) => [region, replace(id)])),
        ]),
      ),
  };
};

export const retireSingleResourceAliases = (layout: WorkbenchLayout, ownedWidgetIds: ReadonlySet<string>) => {
  const replacements = new Map<string, string>();
  for (const region of Object.values(layout.regions)) {
    for (const p of region.widgets) {
      if (
        p.placementIdentity?.kind === "page" &&
        p.placementIdentity.instanceKey === SINGLE_RESOURCE_INSTANCE_KEY &&
        !p.declarationIdentity &&
        ownedWidgetIds.has(p.widgetId)
      )
        replacements.set(p.widgetId, `workbench.page.${crypto.randomUUID()}`);
    }
  }
  return replaceLayoutWidgetIds(layout, replacements);
};
