import type { RegisteredWidgetContribution, WorkbenchLayout } from "./layout-types";

/** Resolve defaults after materialization, when persisted menu placement IDs are known. */
export const selectOwnedPanelMenus = (
  before: WorkbenchLayout,
  layout: WorkbenchLayout,
  ownerWidgetId: string,
  opened: readonly string[],
  getWidget: (id: string) => RegisteredWidgetContribution | undefined,
  getPanelMenuOpen?: (widgetId: string) => boolean | undefined,
) => {
  if (!opened.length) return layout;
  const ids = new Set(opened);
  const regions = { ...layout.regions };
  let changed = false;
  for (const region of Object.values(regions)) {
    const old = before.regions[region.id];
    const previous = old.widgets.find(
      (item) => item.widgetId === old.activeWidgetId && item.menuOwnerWidgetId === ownerWidgetId,
    )?.widgetId;
    const preferred = region.widgets
      .filter((item) => ids.has(item.widgetId))
      .sort(
        (a, b) =>
          Number(getPanelMenuOpen?.(a.widgetId) === true) - Number(getPanelMenuOpen?.(b.widgetId) === true) ||
          Number(a.widgetId === previous) - Number(b.widgetId === previous) ||
          (getWidget(a.contributionId)?.priority ?? 0) - (getWidget(b.contributionId)?.priority ?? 0),
      )
      .at(-1);
    if (!preferred || region.activeWidgetId === preferred.widgetId) continue;
    regions[region.id] = { ...region, activeWidgetId: preferred.widgetId };
    changed = true;
  }
  return changed ? { ...layout, regions } : layout;
};
