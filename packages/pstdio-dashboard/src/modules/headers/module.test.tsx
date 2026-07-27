import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { createHeadersModule } from "./module";

describe("createHeadersModule", () => {
  test("pins the project selector in the global navigation header", () => {
    const workbench = createWorkbenchCore();

    workbench.registerModule(createHeadersModule());

    expect(workbench.layout.listPanelInstances("nav")).toContainEqual(
      expect.objectContaining({
        panelId: dashboardWidgetIds.projectHeader,
        pinned: true,
      }),
    );
  });
});
