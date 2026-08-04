import type { LayoutModel } from "./layout-model-types";
import { closeWidgetInLayout, findPlacementByWidgetId } from "./layout-operations";
import {
  type OpenWorkbenchPanelInput,
  type RegisteredWidgetContribution,
  type WorkbenchLayout,
  type WorkbenchLayoutStoreState,
  type WorkbenchPanelRegion,
  type WorkbenchRegion,
  workbenchPanelRegions,
} from "./layout-types";
import { toOpenWidgetInput, toPanelContribution, toPanelInstance } from "./panel-api";

// A programmatic open into a tabbed region is a peek: it lands as a preview tab that the
// next peek replaces. Chrome regions and pinned placements are structure, so they stay put.
const defaultPanelTabRetention = (widget: RegisteredWidgetContribution, openInput: OpenWorkbenchPanelInput) => {
  if (openInput.pinned) return "persistent" as const;
  const region = openInput.region ?? widget.region ?? widget.fallbackRegion ?? "main";
  return workbenchPanelRegions.includes(region as WorkbenchPanelRegion)
    ? ("preview" as const)
    : ("persistent" as const);
};

interface CreatePanelLayoutMethodsInput {
  getLayout: () => WorkbenchLayout;
  getWidgets: () => WorkbenchLayoutStoreState["widgets"];
  listWidgets: LayoutModel["listWidgets"];
  persistLayout: () => void;
  placementMethods: Pick<LayoutModel, "activateWidget" | "reorderWidget" | "updateWidgetPlacement">;
  setLayout: (layout: WorkbenchLayout) => void;
  widgetOpeners: Pick<LayoutModel, "openWidget">;
}

export const createPanelLayoutMethods = (input: CreatePanelLayoutMethodsInput) => ({
  getPanel(id: string) {
    const widget = input.getWidgets()[id];
    return widget ? toPanelContribution(widget) : undefined;
  },

  listPanels: () => input.listWidgets().map(toPanelContribution),

  listPanelInstances(region?: WorkbenchRegion) {
    const placements = region
      ? input.getLayout().regions[region].widgets
      : Object.values(input.getLayout().regions).flatMap((candidate) => candidate.widgets);
    return placements.map(toPanelInstance);
  },

  getActivePanel(region?: WorkbenchRegion) {
    if (region) {
      const state = input.getLayout().regions[region];
      const placement =
        state.widgets.find((candidate) => candidate.widgetId === state.activeWidgetId) ?? state.widgets[0];
      return placement ? toPanelInstance(placement) : undefined;
    }
    const activeInstanceId = input.getLayout().activeWidgetId;
    if (!activeInstanceId) return undefined;
    const found = findPlacementByWidgetId(input.getLayout(), activeInstanceId);
    return found ? toPanelInstance(found.placement) : undefined;
  },

  openPanel(id: string, openInput: OpenWorkbenchPanelInput = {}) {
    const widget = input.getWidgets()[id];
    if (!widget) throw new Error(`Panel not registered: ${id}`);
    return toPanelInstance(
      input.widgetOpeners.openWidget(id, toOpenWidgetInput(openInput, defaultPanelTabRetention(widget, openInput))),
    );
  },

  updatePanel(instanceId: string, update: OpenWorkbenchPanelInput) {
    if (!findPlacementByWidgetId(input.getLayout(), instanceId)) {
      throw new Error(`Panel instance not found: ${instanceId}`);
    }
    return toPanelInstance(input.placementMethods.updateWidgetPlacement(instanceId, toOpenWidgetInput(update)));
  },

  reorderPanel(instanceId: string, position: Parameters<LayoutModel["reorderPanel"]>[1]) {
    if (!findPlacementByWidgetId(input.getLayout(), instanceId)) {
      throw new Error(`Panel instance not found: ${instanceId}`);
    }
    input.placementMethods.reorderWidget(instanceId, position);
  },

  activatePanel(instanceId: string) {
    if (!findPlacementByWidgetId(input.getLayout(), instanceId)) {
      throw new Error(`Panel instance not found: ${instanceId}`);
    }
    return toPanelInstance(input.placementMethods.activateWidget(instanceId));
  },

  closePanel(instanceId: string) {
    const found = findPlacementByWidgetId(input.getLayout(), instanceId);
    if (!found) throw new Error(`Panel instance not found: ${instanceId}`);
    if (found.placement.closable !== true) throw new Error(`Panel cannot be closed: ${instanceId}`);
    const active = closeWidgetInLayout(input.getLayout(), instanceId);
    if (!active) throw new Error(`Panel instance not found: ${instanceId}`);
    input.setLayout(active.layout);
    input.persistLayout();
    return active.activePlacement ? toPanelInstance(active.activePlacement) : undefined;
  },
});
