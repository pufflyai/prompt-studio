import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench/core";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { createHeadersModule } from "./module";

describe("createHeadersModule", () => {
  test("pins the dashboard header widgets", () => {
    const workbench = createWorkbenchCore();

    workbench.registerModule(createHeadersModule());

    const layout = workbench.layout.getLayout();
    expect(layout.areas.nav.widgets).toContainEqual(
      expect.objectContaining({
        contributionId: dashboardWidgetIds.header,
        pinned: true,
      }),
    );
    expect(layout.areas["left-header"].widgets).toContainEqual(
      expect.objectContaining({
        contributionId: dashboardWidgetIds.leftHeader,
        pinned: true,
      }),
    );
  });
});
