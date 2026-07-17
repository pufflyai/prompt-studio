import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench/core";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { registerDashboardSidebar } from "./dashboard-sidebar";

describe("registerDashboardSidebar", () => {
  test("keeps the sidebar collapsed when a mode opens its widget", () => {
    const workbench = createWorkbenchCore();
    workbench.modes.registerMode({ id: "project", activate: () => undefined });
    workbench.registerModule({
      id: "test.dashboard-sidebar",
      activate: (ctx) => registerDashboardSidebar(ctx),
    });
    workbench.panels.setOpen("left", false);
    workbench.layout.setAreaVisible("left", false);

    workbench.modes.setActiveMode("project");

    expect(workbench.layout.getLayout().areas.left?.widgets[0]?.contributionId).toBe(
      dashboardWidgetIds.dashboardSidebar,
    );
    expect(workbench.panels.isOpen("left")).toBe(false);
    expect(workbench.layout.getLayout().nodes.left?.collapsed).toBe(true);
  });
});
