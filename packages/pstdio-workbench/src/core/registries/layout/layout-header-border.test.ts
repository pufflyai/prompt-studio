import { describe, expect, test } from "bun:test";
import { createLayoutModel, type WidgetContribution } from "./layout-model";

const registerTestWidget = (
  layout: ReturnType<typeof createLayoutModel>,
  widget: Omit<WidgetContribution, "rendererId"> & Partial<Pick<WidgetContribution, "rendererId">>,
) => layout.registerWidget({ rendererId: widget.id, ...widget });

describe("createLayoutModel header border", () => {
  test("resolves header border bottom from the active widget contribution", () => {
    const layout = createLayoutModel();

    registerTestWidget(layout, {
      id: "project.context",
      title: "Project context",
      area: "main",
    });
    registerTestWidget(layout, {
      id: "project.toolbar",
      title: "Project toolbar",
      area: "main",
      headerBorderBottom: false,
    });

    const context = layout.openWidget("project.context");
    layout.openWidget("project.toolbar");

    expect(layout.getAreaHeaderBorderBottom("main")).toBe(false);

    layout.activateWidget(context.widgetId);

    expect(layout.getAreaHeaderBorderBottom("main")).toBe(true);
  });
});
