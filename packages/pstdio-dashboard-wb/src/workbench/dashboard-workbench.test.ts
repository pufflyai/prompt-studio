import { describe, expect, test } from "bun:test";
import { createDashboardWorkbench } from "./dashboard-workbench";
import { dashboardResources } from "./shared/mock-data/resources";
import { dashboardWidgetIds } from "./shared/widget-ids";

describe("dashboard workbench template", () => {
  test("boots into the dashboard project mode with core chrome registered", () => {
    const workbench = createDashboardWorkbench();
    const layout = workbench.layout.getLayout();

    expect(workbench.modes.getActiveModeId()).toBe("project");
    expect(layout.activeWidgetId).toBe(dashboardWidgetIds.workspaces);
    expect(layout.activeResourceUri).toBe(dashboardResources.workspaces.uri);
    expect(layout.areas.top.widgets.map((widget) => widget.contributionId)).toContain(dashboardWidgetIds.header);
  });
});
