import type { LayoutModel } from "./layout-model-types";
import { findPlacementByWidgetId } from "./layout-operations";
import type {
  RegisteredWidgetContribution,
  WorkbenchLayout,
  WorkbenchRegion,
  WorkbenchWidgetPlacement,
} from "./layout-types";

export interface CreateLocationEstablisherInput {
  applyAndActivate(
    layout: WorkbenchLayout,
    regionId: WorkbenchRegion,
    placement: WorkbenchWidgetPlacement,
  ): WorkbenchWidgetPlacement;
  getLayout(): WorkbenchLayout;
  getWidget(id: string): RegisteredWidgetContribution | undefined;
  panelMethods: Pick<LayoutModel, "activatePanel" | "getActivePanel">;
}

export const createLocationEstablisher = (input: CreateLocationEstablisherInput) => (instanceId: string) => {
  const layout = input.getLayout();
  const found = findPlacementByWidgetId(layout, instanceId);
  if (!found) throw new Error(`Panel instance not found: ${instanceId}`);
  // Sub Panels and Panel Menus stay tabs beside their Location: promoting one would
  // create a second Location and clone every Sub Panel per Location.
  if (found.regionId !== "main" || found.placement.role === "sub-panel" || found.placement.role === "panel-menu") {
    return input.panelMethods.activatePanel(instanceId);
  }

  const placement = { ...found.placement, role: "location" as const };
  const ownedPanelMenuIds = new Set(input.getWidget(placement.contributionId)?.ownedPanelMenuIds ?? []);
  const regions = Object.fromEntries(
    Object.entries(layout.regions).map(([regionId, region]) => [
      regionId,
      {
        ...region,
        widgets: region.widgets.map((candidate) => {
          if (candidate.widgetId === instanceId) return placement;
          if (!ownedPanelMenuIds.has(candidate.contributionId)) return candidate;
          if (candidate.resourceKey !== placement.resourceKey) return candidate;
          return { ...candidate, ownerResourceKey: placement.resourceKey };
        }),
      },
    ]),
  ) as WorkbenchLayout["regions"];
  input.applyAndActivate(
    {
      ...layout,
      regions,
    },
    "main",
    placement,
  );
  return input.panelMethods.getActivePanel("main")!;
};
