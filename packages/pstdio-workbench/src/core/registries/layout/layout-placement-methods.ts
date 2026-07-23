import type { LayoutModel } from "./layout-model-types";
import { buildUpdatedPlacement, replaceRegionWidgets } from "./layout-operations";
import { expirePreviewTabsInLayout, reorderWidgetPlacement } from "./layout-tab-lifecycle";
import type {
  RegisteredWidgetContribution,
  WorkbenchLayout,
  WorkbenchRegion,
  WorkbenchWidgetPlacement,
} from "./layout-types";

export const createLayoutPlacementMethods = (input: {
  getLayout(): WorkbenchLayout;
  requireWidget(id: string): RegisteredWidgetContribution;
  setLayout(layout: WorkbenchLayout): void;
  persistLayout(): void;
  applyAndActivate(
    layout: WorkbenchLayout,
    regionId: WorkbenchRegion,
    placement: WorkbenchWidgetPlacement,
  ): WorkbenchWidgetPlacement;
}): Pick<LayoutModel, "updateWidgetPlacement" | "reorderWidget" | "expirePreviewTabs" | "activateWidget"> => ({
  updateWidgetPlacement(widgetId, update) {
    const layout = input.getLayout();
    for (const region of Object.values(layout.regions)) {
      const index = region.widgets.findIndex((placement) => placement.widgetId === widgetId);
      if (index < 0) continue;
      const widget = input.requireWidget(region.widgets[index].contributionId);
      const nextPlacement = buildUpdatedPlacement(region.widgets[index], widget, update);
      const nextLayout = replaceRegionWidgets(layout, region.id, (widgets) =>
        widgets.map((current, currentIndex) => (currentIndex === index ? nextPlacement : current)),
      );
      input.setLayout(nextLayout);
      input.persistLayout();
      return nextPlacement;
    }
    throw new Error(`Widget placement not found: ${widgetId}`);
  },

  reorderWidget(widgetId, position) {
    const layout = input.getLayout();
    for (const region of Object.values(layout.regions)) {
      if (!region.widgets.some((placement) => placement.widgetId === widgetId)) continue;
      input.setLayout(
        replaceRegionWidgets(layout, region.id, (widgets) => reorderWidgetPlacement(widgets, widgetId, position)),
      );
      input.persistLayout();
      return;
    }
    throw new Error(`Widget placement not found: ${widgetId}`);
  },

  expirePreviewTabs(ownerResourceUri) {
    input.setLayout(expirePreviewTabsInLayout(input.getLayout(), ownerResourceUri));
    input.persistLayout();
  },

  activateWidget(widgetId) {
    const layout = input.getLayout();
    for (const region of Object.values(layout.regions)) {
      const placement = region.widgets.find((candidate) => candidate.widgetId === widgetId);
      if (placement) return input.applyAndActivate(layout, region.id, placement);
    }
    throw new Error(`Widget placement not found: ${widgetId}`);
  },
});
