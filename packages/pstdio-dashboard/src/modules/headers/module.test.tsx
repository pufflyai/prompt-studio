import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench/core";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { createHeadersModule } from "./module";

describe("createHeadersModule", () => {
  test("pins the dashboard sidebar header", () => {
    const workbench = createWorkbenchCore();

    workbench.registerModule(createHeadersModule());

    const layout = workbench.layout.getLayout();
    expect(layout.regions["sidebar-header"].widgets).toContainEqual(
      expect.objectContaining({
        contributionId: dashboardWidgetIds.sidebarHeader,
        pinned: true,
      }),
    );
  });
});
