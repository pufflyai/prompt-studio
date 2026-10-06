import type { LayoutModel } from "./layout-model-types";
import {
  closeWidgetInLayout,
  getActiveLocationPlacement,
  selectRegionActiveWidget,
  setLocationSubPanelSelection,
} from "./layout-operations";
import {
  mergeWithDefaultRegions,
  type WorkbenchLayout,
  type WorkbenchPanelRegion,
  type WorkbenchRegion,
  type WorkbenchRegionState,
  workbenchPanelRegions,
} from "./layout-types";

export interface CreateLayoutRegionContentMethodsInput {
  defaultRegionVisibility?: Partial<Record<WorkbenchRegion, boolean>>;
  getLayout(): WorkbenchLayout;
  setLayout(layout: WorkbenchLayout): void;
  persistLayout(): void;
}

// Edits to the widgets inside regions: selecting, closing, clearing, and restoring them.
export const createLayoutRegionContentMethods = (
  input: CreateLayoutRegionContentMethodsInput,
): Pick<
  LayoutModel,
  "setRegionActiveWidget" | "closeWidget" | "removeWidgetPlacement" | "clearRegion" | "resetRegions" | "restoreLayout"
> => {
  const { getLayout, setLayout, persistLayout } = input;

  return {
    setRegionActiveWidget(regionId, widgetId) {
      const nextLayout = selectRegionActiveWidget(getLayout(), regionId, widgetId);
      if (!nextLayout) return;
      setLayout(nextLayout);
      persistLayout();
    },

    closeWidget(widgetId) {
      const result = closeWidgetInLayout(getLayout(), widgetId);
      if (!result) throw new Error(`Widget placement not found: ${widgetId}`);
      if (result.closedPlacement.closable !== true) throw new Error(`Widget cannot be closed: ${widgetId}`);

      setLayout(result.layout);
      persistLayout();
      return result.activePlacement;
    },

    removeWidgetPlacement(widgetId) {
      const result = closeWidgetInLayout(getLayout(), widgetId);
      if (!result) return undefined;
      setLayout(result.layout);
      persistLayout();
      return result.activePlacement;
    },

    clearRegion(regionId) {
      const layout = getLayout();
      const region = layout.regions[regionId];
      const activeWidgetId = region.activeWidgetId;

      const cleared: WorkbenchLayout = {
        ...layout,
        regions: { ...layout.regions, [regionId]: { ...region, widgets: [], activeWidgetId: undefined } },
      };
      let next =
        activeWidgetId && layout.activeWidgetId === activeWidgetId
          ? { ...cleared, activeWidgetId: undefined, activeResourceKey: undefined }
          : cleared;

      if (regionId !== "side" && workbenchPanelRegions.includes(regionId as WorkbenchPanelRegion)) {
        next = setLocationSubPanelSelection(
          next,
          getActiveLocationPlacement(next),
          regionId as WorkbenchPanelRegion,
          undefined,
        );
      }

      setLayout(next);
      persistLayout();
    },

    resetRegions() {
      const layout = getLayout();
      const nextRegions = {} as WorkbenchLayout["regions"];
      for (const [id, region] of Object.entries(layout.regions) as [WorkbenchRegion, WorkbenchRegionState][]) {
        nextRegions[id] = { ...region, widgets: [], activeWidgetId: undefined };
      }
      setLayout({
        regions: nextRegions,
        locationSubPanelSelections: {},
        activeWidgetId: undefined,
        activeLocationWidgetId: undefined,
        activeResourceKey: undefined,
      });
      persistLayout();
    },

    restoreLayout(layout) {
      setLayout(mergeWithDefaultRegions(layout, input.defaultRegionVisibility));
      persistLayout();
    },
  };
};
