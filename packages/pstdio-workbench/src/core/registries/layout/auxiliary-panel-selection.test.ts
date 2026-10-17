import { expect, test } from "bun:test";
import { createDefaultWorkbenchLayout } from "./layout-defaults";
import { activateInLayout, locationWorkspaceKey } from "./layout-operations";
import { reconcileAnchors } from "./surface-reconcile";

for (const region of ["side", "secondary"] as const) {
  test(`activating a page keeps the global ${region} tab selection`, () => {
    const layout = createDefaultWorkbenchLayout();
    const page = { widgetId: "page", contributionId: "page", role: "location" as const, resourceKey: "page" };
    const earlier = { widgetId: "earlier", contributionId: "earlier", role: "sub-panel" as const };
    const selected = { ...earlier, widgetId: "selected", contributionId: "selected" };
    layout.regions.main.widgets = [page];
    layout.regions[region] = {
      ...layout.regions[region],
      widgets: [earlier, selected],
      activeWidgetId: selected.widgetId,
    };
    layout.locationSubPanelSelections = { [locationWorkspaceKey(page)]: { [region]: earlier.widgetId } };
    expect(activateInLayout(layout, "main", page).regions[region].activeWidgetId).toBe(selected.widgetId);
  });

  test(`a manually opened shell tab in ${region} survives leaving a resource-free listing`, () => {
    const layout = createDefaultWorkbenchLayout();
    layout.regions[region].widgets = [
      {
        widgetId: "manual",
        contributionId: "manual",
        role: "sub-panel",
        resource: { type: "session", id: "chosen" },
        placementIdentity: { kind: "shell", placementId: "manual", instanceKey: "chosen" },
      },
    ];
    const actions = reconcileAnchors({ layout, primary: { type: "document", id: "new" }, isInScope: () => false });
    expect(actions.find((action) => action.widgetId === "manual")?.action).not.toBe("clear");
  });
}
