import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "pstdio-workbench/core";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { createHeadersModule } from "./module";

describe("createHeadersModule", () => {
  test("pins the dashboard status widget into the status bar", () => {
    const workbench = createWorkbenchCore();

    workbench.registerModule(createHeadersModule());

    expect(workbench.layout.getLayout().areas.status.widgets).toEqual([
      expect.objectContaining({
        contributionId: dashboardWidgetIds.status,
        pinned: true,
      }),
    ]);
  });
});
