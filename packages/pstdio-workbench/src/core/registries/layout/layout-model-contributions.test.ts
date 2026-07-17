import { describe, expect, test } from "bun:test";
import { createLayoutModel } from "./layout-model";
import { getTestArea, registerTestWidget } from "./layout-model-test-utils";

describe("createLayoutModel placeholders", () => {
  test("registers placeholders outside the widget placement list", () => {
    const layout = createLayoutModel();

    const disposable = layout.registerPlaceholder({
      id: "main.empty",
      title: "Empty main",
      area: "main",
      rendererId: "main.empty",
      areaSize: { defaultPx: 360, minPx: 240 },
      areaCollapsible: false,
    });

    expect(layout.getPlaceholder("main")).toMatchObject({
      id: "main.empty",
      title: "Empty main",
      area: "main",
      rendererId: "main.empty",
    });
    expect(layout.store.getState().placeholders.main).toMatchObject({ id: "main.empty", area: "main" });
    expect(getTestArea(layout.getLayout(), "main").widgets).toEqual([]);
    expect(layout.getAreaSize("main")).toEqual({ defaultPx: 360, minPx: 240 });
    expect(layout.getAreaCollapsible("main")).toBe(false);

    disposable.dispose();

    expect(layout.getPlaceholder("main")).toBeUndefined();
    expect(layout.getAreaSize("main")).toBeUndefined();
    expect(layout.getAreaCollapsible("main")).toBe(true);
  });

  test("uses active widgets instead of the placeholder while widgets are open", () => {
    const layout = createLayoutModel();

    layout.registerPlaceholder({
      id: "main.empty",
      title: "Empty main",
      area: "main",
      rendererId: "main.empty",
      areaSize: { defaultPx: 360, minPx: 240 },
      areaCollapsible: false,
    });
    registerTestWidget(layout, {
      id: "project.preview",
      title: "Preview",
      area: "main",
      areaSize: { defaultPx: 480, minPx: 320 },
      areaCollapsible: true,
      closable: true,
    });

    const preview = layout.openWidget("project.preview");

    expect(layout.getAreaSize("main")).toEqual({ defaultPx: 480, minPx: 320 });
    expect(layout.getAreaCollapsible("main")).toBe(true);

    layout.closeWidget(preview.widgetId);

    expect(getTestArea(layout.getLayout(), "main").widgets).toEqual([]);
    expect(layout.getAreaSize("main")).toEqual({ defaultPx: 360, minPx: 240 });
    expect(layout.getAreaCollapsible("main")).toBe(false);
  });
});
