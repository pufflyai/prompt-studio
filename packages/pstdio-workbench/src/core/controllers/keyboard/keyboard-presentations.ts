import { resourceKey } from "@pstdio/sdk/extensions";
import type { WorkbenchPanelRegion, WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import { resolveArrangement } from "../../registries/layout/panel-positions";
import type { WorkbenchCore } from "../../workbench-core-types";
import { isFullscreenRegionFocusable } from "../fullscreen/main-fullscreen";

export interface KeyboardPresentation extends WorkbenchWidgetPlacement {
  id: string;
  region: WorkbenchPanelRegion;
  label: string;
  number: number;
}
export interface KeyboardTabStrip {
  ids: readonly string[];
  top: number;
  left: number;
}
export type KeyboardTabStrips = Map<WorkbenchPanelRegion, () => KeyboardTabStrip>;
export const regionLabel = (region: string) =>
  ({ main: "Main", secondary: "Secondary", side: "Side" })[region] ?? region;
export const visibleKeyboardRegions = (core: WorkbenchCore) => {
  const layout = core.layout.getLayout();
  const arrangement = resolveArrangement(layout.arrangement);
  const vertical: WorkbenchPanelRegion[] =
    arrangement.secondary === "top" ? ["secondary", "main"] : ["main", "secondary"];
  const order: WorkbenchPanelRegion[] =
    arrangement.side === "left" ? ["side", ...vertical] : [vertical[0]!, "side", vertical[1]!];
  return order.filter(
    (region) => layout.regions[region].visible && isFullscreenRegionFocusable(core, region) !== false,
  );
};
export const listKeyboardTabs = (core: WorkbenchCore, strips: KeyboardTabStrips = new Map()) => {
  const layout = core.layout.getLayout();
  const regions = visibleKeyboardRegions(core).flatMap((region) => {
    const strip = strips.get(region)?.();
    if (strips.size && !strip) return [];
    if (
      !strip &&
      layout.regions[region].widgets.length === 1 &&
      !layout.regions[region].widgets[0]?.closable &&
      !core.layout.getRegionSettings(region)?.alwaysShowTabs
    )
      return [];
    return [{ region, strip }];
  });
  if (regions.every((item) => item.strip))
    regions.sort((a, b) => a.strip!.top - b.strip!.top || a.strip!.left - b.strip!.left);
  return regions
    .flatMap(({ region, strip }) => {
      const widgets = layout.regions[region].widgets;
      const ordered = strip
        ? strip.ids.flatMap((id) => {
            const tab = widgets.find((tab) => tab.widgetId === id);
            return tab ? [tab] : [];
          })
        : widgets;
      return ordered.map((tab) => ({
        ...tab,
        id: tab.widgetId,
        region,
        number: 0,
        label: tab.title ?? tab.resource?.label ?? core.layout.getWidget(tab.contributionId)?.title ?? tab.widgetId,
      }));
    })
    .map((tab, index) => ({ ...tab, number: index + 1 }));
};
export const visibleKeyboardTargets = (core: WorkbenchCore, isVisible: (id: string) => boolean = () => true) =>
  visibleKeyboardRegions(core).flatMap((region) => {
    const layout = core.layout.getLayout();
    return [region, `${region}-left-menu`, `${region}-right-menu`].flatMap((id) => {
      const state = layout.regions[id as keyof typeof layout.regions];
      if (!state.visible) return [];
      const visible = state.widgets.filter((tab) => isVisible(tab.widgetId));
      const tab = visible.find((candidate) => candidate.widgetId === state.activeWidgetId) ?? visible[0];
      if (!tab) return [];
      return [
        {
          ...tab,
          id: tab.widgetId,
          region,
          number: 0,
          label: tab.resource?.label ?? tab.title ?? core.layout.getWidget(tab.contributionId)?.title ?? tab.widgetId,
        },
      ];
    });
  });
export const presentationResourceKey = (presentation: KeyboardPresentation) => resourceKey(presentation.resource);
