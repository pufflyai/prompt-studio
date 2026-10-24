import { type WorkbenchRegion, type WorkbenchWidgetPlacement, workbenchPanelRegions } from "./layout-types";

export const placementTabState = (
  region: WorkbenchRegion,
  desired: WorkbenchWidgetPlacement,
  current?: WorkbenchWidgetPlacement,
) => {
  if (!workbenchPanelRegions.some((panel) => panel === region)) return {};
  const tabRetention = desired.tabRetention ?? current?.tabRetention ?? "persistent";
  return { tabRetention, pinned: tabRetention === "persistent" };
};
