import { describe, expect, test } from "bun:test";
import { createWorkbench } from "@pstdio/workbench";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { createHeadersModule } from "./module";

describe("createHeadersModule", () => {
  test("places the project selector in Nav Chrome without adding it to the Sidenav", async () => {
    const workbench = createWorkbench();

    workbench.registerModule(createHeadersModule());

    expect(workbench.layout.listPanelInstances("nav")).toContainEqual(
      expect.objectContaining({
        viewId: dashboardWidgetIds.projectHeader,
        closable: false,
      }),
    );
    expect(
      await workbench.navigationTrees.getSections({ kind: "mode", id: "project", extensionId: "pstdio" }, "header"),
    ).toEqual([]);
  });
});
