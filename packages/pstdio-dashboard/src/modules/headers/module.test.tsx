import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench/core";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { createHeadersModule } from "./module";

describe("createHeadersModule", () => {
  test("pins nav content and registers the left header region renderer", () => {
    const workbench = createWorkbenchCore();

    workbench.registerModule(createHeadersModule());

    const layout = workbench.layout.getLayout();
    expect(layout.areas.nav.widgets).toContainEqual(
      expect.objectContaining({
        contributionId: dashboardWidgetIds.header,
        pinned: true,
      }),
    );
    expect(workbench.renderers.getRenderer("left-header")).toBeDefined();
  });

  test("restores dashboard headers when the mode scope changes", () => {
    const workbench = createWorkbenchCore();
    workbench.registerModule(createHeadersModule());

    workbench.layout.setPersistenceScope({ mode: "workspace" });

    expect(workbench.layout.getLayout().areas.nav.widgets[0]?.contributionId).toBe(dashboardWidgetIds.header);
    expect(workbench.renderers.getRenderer("left-header")).toBeDefined();
  });
});
