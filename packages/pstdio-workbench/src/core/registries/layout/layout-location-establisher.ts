import type { LayoutModel } from "./layout-model-types";
import { findPlacementByWidgetId } from "./layout-operations";
import type {
  RegisteredWidgetContribution,
  WorkbenchLayout,
  WorkbenchPanelInstance,
  WorkbenchRegion,
  WorkbenchWidgetPlacement,
} from "./layout-types";

export interface LocationAwareLayoutModel extends LayoutModel {
  establishLocation(instanceId: string): WorkbenchPanelInstance;
}

interface CreateLocationEstablisherInput {
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
  if (found.regionId !== "main") return input.panelMethods.activatePanel(instanceId);

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
          if (candidate.resourceUri !== placement.resourceUri) return candidate;
          return { ...candidate, ownerResourceUri: placement.resourceUri };
        }),
      },
    ]),
  ) as WorkbenchLayout["regions"];
  input.applyAndActivate({ ...layout, regions }, "main", placement);
  return input.panelMethods.getActivePanel("main")!;
};
